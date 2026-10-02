package com.thesystem.workouttracker

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import org.json.JSONArray
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.CancellationException
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val health: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(this) }
    private val permissions = setOf(StepsRecord::class, ExerciseSessionRecord::class, ActiveCaloriesBurnedRecord::class, TotalCaloriesBurnedRecord::class, HeartRateRecord::class, DistanceRecord::class, SleepSessionRecord::class).map { HealthPermission.getReadPermission(it) }.toSet()
    private var permissionReply: JavaScriptReplyProxy? = null

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val ok = granted.containsAll(requestedPermissions)
        permissionReply?.postMessage(JSONObject().put("id", pendingPermissionId).put("result", JSONObject().put("granted", ok).put("permissions", JSONArray(granted.toList()))).toString())
        permissionReply = null
        pendingPermissionId = ""
    }
    private var pendingPermissionId = ""
    private var requestedPermissions = emptySet<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.clearCache(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
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
            WebViewCompat.addWebMessageListener(webView, "SystemHealthNative", setOf("https://appassets.androidplatform.net")) { _, message, _, isMainFrame, reply ->
                if (isMainFrame) handleHealthMessage(message, reply)
            }
        }
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun status(): String = when (HealthConnectClient.getSdkStatus(this)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "provider-update-required"
        else -> "unavailable"
    }

    private fun respond(reply: JavaScriptReplyProxy, id: String, result: JSONObject) {
        reply.postMessage(JSONObject().put("id", id).put("result", result).toString())
    }

    private fun handleHealthMessage(message: WebMessageCompat, reply: JavaScriptReplyProxy) {
        val json = runCatching { JSONObject(message.data ?: "{}") }.getOrNull() ?: return
        val id = json.optString("id")
        val method = json.optString("method")
        lifecycleScope.launch {
            try {
                val availability = status()
                if (method == "getStatus") {
                    val granted = if (availability == "available") health.permissionController.getGrantedPermissions() else emptySet()
                    respond(reply, id, JSONObject().put("availability", availability)
                        .put("connected", granted.containsAll(permissions))
                        .put("permissions", JSONArray(granted.toList())).put("required", JSONArray(permissions.toList())))
                    return@launch
                }
                if (method == "openSettings") {
                    startActivity(if (availability == "available") Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                        else Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata")))
                    respond(reply, id, JSONObject().put("opened", true))
                    return@launch
                }
                if (availability != "available") {
                    respond(reply, id, JSONObject().put("error", availability)); return@launch
                }
                when (method) {
                    "requestStepPermission", "requestPermissions" -> {
                        if (permissionReply != null) {
                            respond(reply, id, JSONObject().put("error", "permission-request-in-progress")); return@launch
                        }
                        requestedPermissions = if (method == "requestStepPermission") setOf(HealthPermission.getReadPermission(StepsRecord::class)) else permissions
                        val granted = health.permissionController.getGrantedPermissions()
                        if (granted.containsAll(requestedPermissions)) {
                            respond(reply, id, JSONObject().put("granted", true).put("permissions", JSONArray(granted.toList())))
                        } else {
                            pendingPermissionId = id
                            permissionReply = reply
                            permissionLauncher.launch(requestedPermissions)
                        }
                    }
                    "getTodaySteps" -> {
                        val range = todayRange()
                        val result = health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), range))
                        respond(reply, id, JSONObject().put("steps", result[StepsRecord.COUNT_TOTAL] ?: 0L).put("date", LocalDate.now().toString()))
                    }
                    "readHealthData", "getTodayMetrics" -> respond(reply, id, readHealthData())
                    else -> respond(reply, id, JSONObject().put("error", "unknown-method"))
                }
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) {
                if (permissionReply === reply) { permissionReply = null; pendingPermissionId = "" }
                respond(reply, id, JSONObject().put("error", if (e is SecurityException) "permission-required" else "health-read-failed"))
            }
        }
    }

    private fun todayRange(now: java.time.Instant = java.time.Instant.now()): TimeRangeFilter {
        val zone = ZoneId.systemDefault()
        return TimeRangeFilter.between(now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant(), now)
    }

    private suspend fun readHealthData(): JSONObject {
        val granted = health.permissionController.getGrantedPermissions()
        val now = java.time.Instant.now()
        val range = todayRange(now)
        val output = JSONObject().put("date", now.atZone(ZoneId.systemDefault()).toLocalDate().toString()).put("syncedAt", now.toString()).put("timeZone", ZoneId.systemDefault().id)
            .put("todayStart", now.atZone(ZoneId.systemDefault()).toLocalDate().atStartOfDay(ZoneId.systemDefault()).toInstant().toString())
            .put("sleepStart", now.minusSeconds(86400).toString())
        val errors = JSONObject()
        suspend fun read(key: String, permission: String, block: suspend () -> Any?) {
            if (!granted.contains(permission)) { errors.put(key, "permission-required"); return }
            try { output.put(key, block() ?: JSONObject.NULL) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { errors.put(key, if (e is SecurityException) "permission-required" else "health-read-failed") }
        }
        read("steps", HealthPermission.getReadPermission(StepsRecord::class)) {
            health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), range))[StepsRecord.COUNT_TOTAL]
        }
        read("activeCalories", HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)) {
            health.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), range))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
        }
        read("totalCalories", HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)) {
            health.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), range))[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
        }
        read("distanceMeters", HealthPermission.getReadPermission(DistanceRecord::class)) {
            health.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), range))[DistanceRecord.DISTANCE_TOTAL]?.inMeters
        }
        read("heartRate", HealthPermission.getReadPermission(HeartRateRecord::class)) {
            val result = health.aggregate(AggregateRequest(setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MIN, HeartRateRecord.BPM_MAX), range))
            JSONObject().put("average", result[HeartRateRecord.BPM_AVG] ?: JSONObject.NULL)
                .put("min", result[HeartRateRecord.BPM_MIN] ?: JSONObject.NULL).put("max", result[HeartRateRecord.BPM_MAX] ?: JSONObject.NULL)
        }
        read("activeMinutes", HealthPermission.getReadPermission(ExerciseSessionRecord::class)) {
            health.aggregate(AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL), range))[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes()
        }
        read("exerciseSessions", HealthPermission.getReadPermission(ExerciseSessionRecord::class)) {
            val rows = JSONArray()
            var token: String? = null
            do {
                val page = health.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range, pageToken = token))
                page.records.forEach { rows.put(JSONObject().put("start", it.startTime.toString()).put("end", it.endTime.toString())
                    .put("type", it.exerciseType).put("source", it.metadata.dataOrigin.packageName)) }
                token = page.pageToken
            } while (token != null)
            rows
        }
        read("sleepSessions", HealthPermission.getReadPermission(SleepSessionRecord::class)) {
            // Rolling 24 hours includes overnight sleep crossing local midnight.
            val sleepRange = TimeRangeFilter.between(now.minusSeconds(86400), now)
            val rows = JSONArray()
            var token: String? = null
            do {
                val page = health.readRecords(ReadRecordsRequest(SleepSessionRecord::class, sleepRange, pageToken = token))
                page.records.forEach { rows.put(JSONObject().put("start", it.startTime.toString()).put("end", it.endTime.toString())
                    .put("source", it.metadata.dataOrigin.packageName)) }
                token = page.pageToken
            } while (token != null)
            rows
        }
        return output.put("errors", errors)
    }
}

