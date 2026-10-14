package com.thesystem.workouttracker

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.metadata.Metadata
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONArray
import androidx.health.connect.client.records.*
import androidx.health.connect.client.aggregate.AggregateMetric
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class MainActivity : ComponentActivity() {
    private var pendingBackupName = "the-system-backup.json"
    private var pendingBackupJson = ""
    private val backupLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri -> uri?.let { contentResolver.openOutputStream(it)?.use { out -> out.write(pendingBackupJson.toByteArray(Charsets.UTF_8)) } } }
    inner class SystemAndroidBridge { @JavascriptInterface fun exportBackup(name: String, json: String) { runOnUiThread { pendingBackupName=name; pendingBackupJson=json; backupLauncher.launch(name) } }; @JavascriptInterface fun getAppVersion(): String { val p=packageManager.getPackageInfo(packageName,0); return p.versionName + " / build " + androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(p) } }
    private lateinit var webView: WebView
    private lateinit var health: HealthConnectClient
    private var permissionReply: JavaScriptReplyProxy? = null

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val ok = granted.isNotEmpty()
        permissionReply?.postMessage(JSONObject().put("id", pendingPermissionId).put("result", JSONObject().put("granted", ok)).toString())
        permissionReply = null
        pendingPermissionId = ""
    }
    private var pendingPermissionId = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        health = HealthConnectClient.getOrCreate(this)
        webView = WebView(this)
        setContentView(webView)
        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.clearCache(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.addJavascriptInterface(SystemAndroidBridge(), "SystemAndroid")
        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: android.webkit.WebResourceRequest
            ): android.webkit.WebResourceResponse? {
                val uri = request.url
                // Intercept only the virtual local app origin. Supabase authentication
                // and every other remote HTTPS request must be handled by WebView networking.
                return if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") {
                    loader.shouldInterceptRequest(uri)
                } else {
                    super.shouldInterceptRequest(view, request)
                }
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "SystemHealthNative", setOf("https://appassets.androidplatform.net")) { _, message, _, _, reply ->
                handleHealthMessage(message, reply)
            }
        }
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun handleHealthMessage(message: WebMessageCompat, reply: JavaScriptReplyProxy) {
        val json = runCatching { JSONObject(message.data ?: "{}") }.getOrNull() ?: return
        val id = json.optString("id")
        when (json.optString("method")) {
            "requestStepPermission" -> {
                healthTask(id, reply) {
                    val permissions = healthPermissions()
                    if (health.permissionController.getGrantedPermissions().containsAll(permissions)) {
                        reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("granted", true)).toString())
                    } else {
                        pendingPermissionId = id
                        permissionReply = reply
                        permissionLauncher.launch(permissions)
                    }
                }
            }
            "getRecentHeartRate" -> healthTask(id, reply) {
                val end = java.time.Instant.now()
                val minutes = json.optLong("minutes", 15).coerceIn(1, 120)
                val start = end.minusSeconds(minutes * 60)
                val records = health.readRecords(ReadRecordsRequest(HeartRateRecord::class, TimeRangeFilter.between(start, end))).records
                val samples = records.flatMap { it.samples }.filter { !it.time.isBefore(start) && !it.time.isAfter(end) }
                val result = if (samples.isEmpty()) JSONObject().put("latest", 0).put("average", 0).put("minimum", 0).put("maximum", 0)
                    else { val bpms=samples.map{it.beatsPerMinute.toInt()}; val latest=samples.maxByOrNull{it.time}; JSONObject().put("latest",latest?.beatsPerMinute?.toInt()?:0).put("average",bpms.average().toInt()).put("minimum",bpms.minOrNull()?:0).put("maximum",bpms.maxOrNull()?:0).put("sampledAt",latest?.time?.toString()) }
                reply.postMessage(JSONObject().put("id", id).put("result", result).toString())
            }
            "getTodaySteps", "getTodayMetrics", "getHealthDashboard" -> healthTask(id, reply) {
                try {
                    val result = readHealthDashboard(if (json.optString("method") == "getTodaySteps") 1 else 7)
                    reply.postMessage(JSONObject().put("id", id).put("result", result).toString())
                } catch (e: Exception) {
                    reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("error", "health-read-failed")).toString())
                }
            }
            else -> reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("error", "unsupported-health-method")).toString())
        }
    }

    private fun healthTask(id: String, reply: JavaScriptReplyProxy, block: suspend () -> Unit) {
        lifecycleScope.launch {
            try { block() }
            catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (e: Exception) {
                reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("error", "health-read-failed")).toString())
            }
        }
    }

    private fun healthPermissions() = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    private suspend fun readHealthDashboard(days: Int): JSONObject {
        val granted = health.permissionController.getGrantedPermissions()
        fun allowed(permission: String) = granted.contains(permission)
        val metrics = mutableSetOf<AggregateMetric<*>>()
        val available = JSONObject()
        fun add(key: String, permission: String, metric: AggregateMetric<*>) {
            val ok = allowed(permission)
            available.put(key, ok)
            if (ok) metrics.add(metric)
        }
        add("steps", HealthPermission.getReadPermission(StepsRecord::class), StepsRecord.COUNT_TOTAL)
        add("activeMinutes", HealthPermission.getReadPermission(ExerciseSessionRecord::class), ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)
        add("calories", HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class), TotalCaloriesBurnedRecord.ENERGY_TOTAL)
        add("distanceMeters", HealthPermission.getReadPermission(DistanceRecord::class), DistanceRecord.DISTANCE_TOTAL)
        add("sleepMinutes", HealthPermission.getReadPermission(SleepSessionRecord::class), SleepSessionRecord.SLEEP_DURATION_TOTAL)
        add("heartRate", HealthPermission.getReadPermission(HeartRateRecord::class), HeartRateRecord.BPM_AVG)
        if (available.optBoolean("heartRate")) { metrics.add(HeartRateRecord.BPM_MIN); metrics.add(HeartRateRecord.BPM_MAX) }
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val now = Instant.now()
        val daily = JSONArray()
        for (offset in (days - 1) downTo 0) {
            val date = today.minusDays(offset.toLong())
            val start = date.atStartOfDay(zone).toInstant()
            val end = if (offset == 0) now else date.plusDays(1).atStartOfDay(zone).toInstant()
            val row = JSONObject().put("date", date.toString())
            if (metrics.isNotEmpty()) {
                val result = health.aggregate(AggregateRequest(metrics, TimeRangeFilter.between(start, end)))
                row.put("steps", result[StepsRecord.COUNT_TOTAL] ?: JSONObject.NULL)
                row.put("activeMinutes", result[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMillis()?.div(60000.0) ?: JSONObject.NULL)
                row.put("calories", result[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: JSONObject.NULL)
                row.put("distanceMeters", result[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: JSONObject.NULL)
                row.put("sleepMinutes", result[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMillis()?.div(60000.0) ?: JSONObject.NULL)
                row.put("heartRate", result[HeartRateRecord.BPM_AVG] ?: JSONObject.NULL)
                row.put("heartRateMin", result[HeartRateRecord.BPM_MIN] ?: JSONObject.NULL)
                row.put("heartRateMax", result[HeartRateRecord.BPM_MAX] ?: JSONObject.NULL)
            }
            daily.put(row)
        }
        val workouts = JSONArray()
        if (available.optBoolean("activeMinutes")) {
            val start = today.minusDays((days - 1).toLong()).atStartOfDay(zone).toInstant()
            var token: String? = null
            do {
                val response = health.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(start, now), pageToken = token))
                response.records.forEach { record ->
                    workouts.put(JSONObject().put("title", record.title ?: "Recorded workout").put("startTime", record.startTime.toString()).put("endTime", record.endTime.toString()).put("minutes", java.time.Duration.between(record.startTime, record.endTime).toMillis() / 60000.0).put("source", record.metadata.dataOrigin.packageName))
                }
                token = response.pageToken
            } while (token != null)
        }
        return JSONObject().put("today", daily.getJSONObject(daily.length() - 1)).put("days", daily).put("workouts", workouts).put("permissions", available).put("timeZone", zone.id).put("steps", daily.getJSONObject(daily.length() - 1).opt("steps") ?: JSONObject.NULL)
    }
}
