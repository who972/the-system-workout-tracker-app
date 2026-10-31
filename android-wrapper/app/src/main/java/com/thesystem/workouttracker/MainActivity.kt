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
import androidx.lifecycle.withResumed
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
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.records.metadata.Device
import java.time.LocalDate
import java.time.ZoneId

class MainActivity : ComponentActivity() {
    private var pendingBackupName = "the-system-backup.json"
    private var pendingBackupJson = ""
    private val backupLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri -> uri?.let { contentResolver.openOutputStream(it)?.use { out -> out.write(pendingBackupJson.toByteArray(Charsets.UTF_8)) } } }
    inner class SystemAndroidBridge { @JavascriptInterface fun keepWorkoutScreenOn(enabled: Boolean) { runOnUiThread { webView.keepScreenOn = enabled } }; @JavascriptInterface fun exportBackup(name: String, json: String) { runOnUiThread { pendingBackupName=name; pendingBackupJson=json; backupLauncher.launch(name) } }; @JavascriptInterface fun getAppVersion(): String { val p=packageManager.getPackageInfo(packageName,0); return p.versionName + " / build " + androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(p) } }
    private val voice by lazy { SystemVoice(this) { type, text ->
        if (::webView.isInitialized) webView.evaluateJavascript("window.SystemAssistant?.nativeEvent(" + JSONObject().put("type",type).put("text",text).toString() + ")", null)
    } }
    private var voiceRequested = false
    private val microphoneLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if(granted && voiceRequested && !isFinishing) lifecycleScope.launch {
            lifecycle.withResumed { if(voiceRequested && !isFinishing) voice.listen() }
        }
        else if(voiceRequested && ::webView.isInitialized) webView.evaluateJavascript("window.SystemAssistant?.nativeEvent({type:'error',text:'Microphone permission was not granted. You can type a command instead.'})",null)
    }
    inner class SystemVoiceBridge {
        @JavascriptInterface fun available(): Boolean = voice.available()
        @JavascriptInterface fun listen() { runOnUiThread {
            voiceRequested=true
            if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)==android.content.pm.PackageManager.PERMISSION_GRANTED) voice.listen()
            else microphoneLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
        } }
        @JavascriptInterface fun speak(text: String) { runOnUiThread { voice.speak(text) } }
        @JavascriptInterface fun stop() { runOnUiThread { voiceRequested=false;voice.stop() } }
    }
    override fun onPause() { webView.keepScreenOn = false; voice.stop(); super.onPause() }
    override fun onDestroy() { voice.close();super.onDestroy() }
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
        // Health data is optional. Provider absence must never prevent app startup.
        optionalHealthClient(
            { HealthConnectClient.getSdkStatus(this) == HealthConnectClient.SDK_AVAILABLE },
            { HealthConnectClient.getOrCreate(this) }
        )?.let { health = it }
        webView = WebView(this)
        setContentView(webView)
        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.clearCache(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.addJavascriptInterface(SystemAndroidBridge(), "SystemAndroid")
        webView.addJavascriptInterface(SystemVoiceBridge(), "SystemVoiceNative")
        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") return false
                if (uri.scheme in setOf("https", "mailto")) runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                return true
            }
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
                if (::health.isInitialized) handleHealthMessage(message, reply)
                else {
                    val id = runCatching { JSONObject(message.data ?: "{}").optString("id") }.getOrDefault("")
                    reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("error", "health-unavailable")).toString())
                }
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
                val provider = chooseHealthSource(records.map { SourceInterval(it.metadata.dataOrigin.packageName, it.startTime, it.endTime) }, start, end)
                val samples = records.filter { it.metadata.dataOrigin.packageName == provider }.flatMap { it.samples }.filter { !it.time.isBefore(start) && !it.time.isAfter(end) }
                val result = if (samples.isEmpty()) JSONObject().put("latest", 0).put("average", 0).put("minimum", 0).put("maximum", 0)
                    else { val bpms=samples.map{it.beatsPerMinute.toInt()}; val latest=samples.maxByOrNull{it.time}; JSONObject().put("latest",latest?.beatsPerMinute?.toInt()?:0).put("average",bpms.average().toInt()).put("minimum",bpms.minOrNull()?:0).put("maximum",bpms.maxOrNull()?:0).put("sampledAt",latest?.time?.toString()) }
                reply.postMessage(JSONObject().put("id", id).put("result", result).toString())
            }
            "getTodaySteps", "getTodayMetrics", "getHealthDashboard" -> healthTask(id, reply) {
                try {
                    val result = readHealthDashboard(if (json.optString("method") == "getTodaySteps") 1 else 7, json.optString("source", "all"))
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

    private fun healthSourceName(packageName: String): String = when (packageName) {
        "com.sec.android.app.shealth" -> "Samsung Health"
        "com.fitbit.FitbitMobile" -> "Fitbit"
        "com.google.android.apps.fitness" -> "Google Fit"
        else -> runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString() }.getOrDefault(packageName)
    }

    private suspend fun readHealthDashboard(days: Int, source: String): JSONObject {
        val origins = emptySet<DataOrigin>()
        val granted = health.permissionController.getGrantedPermissions()
        fun allowed(permission: String) = granted.contains(permission)
        val metrics = mutableSetOf<AggregateMetric<*>>()
        val available = JSONObject()
        fun add(key: String, permission: String, metric: AggregateMetric<*>) {
            val ok = allowed(permission)
            available.put(key, ok)
            if (ok && key != "calories" && key != "heartRate" && key != "steps") metrics.add(metric)
        }
        add("steps", HealthPermission.getReadPermission(StepsRecord::class), StepsRecord.COUNT_TOTAL)
        add("activeMinutes", HealthPermission.getReadPermission(ExerciseSessionRecord::class), ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)
        add("calories", HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class), TotalCaloriesBurnedRecord.ENERGY_TOTAL)
        add("distanceMeters", HealthPermission.getReadPermission(DistanceRecord::class), DistanceRecord.DISTANCE_TOTAL)
        add("sleepMinutes", HealthPermission.getReadPermission(SleepSessionRecord::class), SleepSessionRecord.SLEEP_DURATION_TOTAL)
        add("heartRate", HealthPermission.getReadPermission(HeartRateRecord::class), HeartRateRecord.BPM_AVG)

        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val now = Instant.now()
        val daily = JSONArray()
        for (offset in (days - 1) downTo 0) {
            val date = today.minusDays(offset.toLong())
            val start = date.atStartOfDay(zone).toInstant()
            val end = if (offset == 0) now else date.plusDays(1).atStartOfDay(zone).toInstant()
            val row = JSONObject().put("date", date.toString())
            if (available.keys().asSequence().any { available.optBoolean(it) }) {
                val result = if (metrics.isEmpty()) null else health.aggregate(AggregateRequest(metrics, TimeRangeFilter.between(start, end), dataOriginFilter = origins))
                if (available.optBoolean("steps")) {
                    val records = mutableListOf<StepsRecord>()
                    var page: String? = null
                    do {
                        val response = health.readRecords(ReadRecordsRequest(StepsRecord::class, TimeRangeFilter.between(start, end), pageToken = page))
                        records.addAll(response.records); page = response.pageToken
                    } while (page != null)
                    val preferred = chooseStepSource(records.map { SourceInterval(it.metadata.dataOrigin.packageName, it.startTime, it.endTime, it.metadata.device?.type == Device.TYPE_WATCH) }, start, end)
                    if (preferred != null) {
                        val single = health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end), dataOriginFilter = setOf(DataOrigin(preferred))))
                        row.put("steps", single[StepsRecord.COUNT_TOTAL] ?: JSONObject.NULL).put("stepsSource", healthSourceName(preferred))
                    }
                }
                row.put("activeMinutes", result?.get(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)?.toMillis()?.div(60000.0) ?: JSONObject.NULL)
                if (available.optBoolean("calories")) {
                    val records = mutableListOf<TotalCaloriesBurnedRecord>()
                    var page: String? = null
                    do {
                        val response = health.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, TimeRangeFilter.between(start, end), pageToken = page))
                        records.addAll(response.records); page = response.pageToken
                    } while (page != null)
                    val summary = health.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), TimeRangeFilter.between(start, end)))
                    val preferred = chooseHealthSource(records.map { SourceInterval(it.metadata.dataOrigin.packageName, it.startTime, it.endTime) }, start, end)
                    val candidates = (listOfNotNull(preferred) + summary.dataOrigins.map { it.packageName }.sorted()).distinct()
                    var selected = false
                    for (provider in candidates) {
                        val calories = health.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), TimeRangeFilter.between(start, end), dataOriginFilter = setOf(DataOrigin(provider))))
                        val value = calories[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                        if (value != null) {
                            row.put("calories", value).put("caloriesSource", healthSourceName(provider))
                            selected = true
                            break
                        }
                    }
                    // Health Connect can provide a platform-derived total without
                    // raw calorie records. Only use that total when no multi-source
                    // combination is reported; never fall back to a mixed total.
                    if (!selected && summary.dataOrigins.size <= 1) {
                        val value = summary[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                        if (value != null) row.put("calories", value).put("caloriesSource", summary.dataOrigins.firstOrNull()?.let { healthSourceName(it.packageName) } ?: "Health Connect estimate")
                    }
                }
                row.put("distanceMeters", result?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters ?: JSONObject.NULL)
                row.put("sleepMinutes", result?.get(SleepSessionRecord.SLEEP_DURATION_TOTAL)?.toMillis()?.div(60000.0) ?: JSONObject.NULL)
                if (available.optBoolean("heartRate")) {
                    val records = mutableListOf<HeartRateRecord>()
                    var page: String? = null
                    do {
                        val response = health.readRecords(ReadRecordsRequest(HeartRateRecord::class, TimeRangeFilter.between(start, end), pageToken = page))
                        records.addAll(response.records); page = response.pageToken
                    } while (page != null)
                    val provider = chooseHealthSource(records.filter { it.samples.any { sample -> !sample.time.isBefore(start) && sample.time.isBefore(end) } }.map { SourceInterval(it.metadata.dataOrigin.packageName, it.startTime, it.endTime) }, start, end)
                    if (provider != null) {
                        val hr = health.aggregate(AggregateRequest(setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MIN, HeartRateRecord.BPM_MAX), TimeRangeFilter.between(start, end), dataOriginFilter = setOf(DataOrigin(provider))))
                        row.put("heartRate", hr[HeartRateRecord.BPM_AVG] ?: JSONObject.NULL)
                        row.put("heartRateMin", hr[HeartRateRecord.BPM_MIN] ?: JSONObject.NULL)
                        row.put("heartRateMax", hr[HeartRateRecord.BPM_MAX] ?: JSONObject.NULL)
                        row.put("heartRateSource", healthSourceName(provider))
                    }
                }
            }
            daily.put(row)
        }
        val workouts = JSONArray()
        if (available.optBoolean("activeMinutes")) {
            val start = today.minusDays((days - 1).toLong()).atStartOfDay(zone).toInstant()
            var token: String? = null
            do {
                val response = health.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(start, now), dataOriginFilter = origins, pageToken = token))
                response.records.forEach { record ->
                    workouts.put(JSONObject().put("title", record.title ?: "Recorded workout").put("startTime", record.startTime.toString()).put("endTime", record.endTime.toString()).put("minutes", java.time.Duration.between(record.startTime, record.endTime).toMillis() / 60000.0).put("source", record.metadata.dataOrigin.packageName))
                }
                token = response.pageToken
            } while (token != null)
        }
        // Keep complete intervals across midnight. The UI groups by wake date.
        val sleepSessions = JSONArray()
        var sleepReadError = false
        if (available.optBoolean("sleepMinutes")) {
            try {
                val sleepStart = today.minusDays(days.toLong()).atStartOfDay(zone).toInstant()
                var sleepToken: String? = null
                do {
                    val response = health.readRecords(ReadRecordsRequest(
                        SleepSessionRecord::class, TimeRangeFilter.between(sleepStart, now),
                        pageToken = sleepToken
                    ))
                    response.records.filter { !it.endTime.isAfter(now) }.forEach { record ->
                        val stages = JSONArray()
                        record.stages.forEach { stage ->
                            stages.put(JSONObject().put("startTime", stage.startTime.toString())
                                .put("endTime", stage.endTime.toString()).put("stage", stage.stage))
                        }
                        sleepSessions.put(JSONObject().put("id", record.metadata.id)
                            .put("source", record.metadata.dataOrigin.packageName)
                            .put("sourceName", healthSourceName(record.metadata.dataOrigin.packageName))
                            .put("startTime", record.startTime.toString())
                            .put("endTime", record.endTime.toString()).put("stages", stages))
                    }
                    sleepToken = response.pageToken
                } while (sleepToken != null)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                // Do not publish an incomplete page as a complete sleep history.
                sleepReadError = true
            }
        }
        return JSONObject().put("source", "automatic").put("today", daily.getJSONObject(daily.length() - 1)).put("days", daily).put("workouts", workouts).put("permissions", available).put("timeZone", zone.id).put("sleepSessions", if (sleepReadError) JSONArray() else sleepSessions).put("sleepReadError", sleepReadError).put("steps", daily.getJSONObject(daily.length() - 1).opt("steps") ?: JSONObject.NULL)
    }
}
