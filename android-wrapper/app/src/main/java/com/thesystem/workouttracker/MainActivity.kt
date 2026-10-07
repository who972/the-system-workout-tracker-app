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
        val required = setOf(HealthPermission.getReadPermission(StepsRecord::class), HealthPermission.getReadPermission(HeartRateRecord::class))
        val ok = granted.containsAll(required)
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
                lifecycleScope.launch {
                    val permissions = setOf(HealthPermission.getReadPermission(StepsRecord::class), HealthPermission.getReadPermission(HeartRateRecord::class))
                    if (health.permissionController.getGrantedPermissions().containsAll(permissions)) {
                        reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("granted", true)).toString())
                    } else {
                        pendingPermissionId = id
                        permissionReply = reply
                        permissionLauncher.launch(permissions)
                    }
                }
            }
            "getRecentHeartRate" -> lifecycleScope.launch {
                val end = java.time.Instant.now()
                val minutes = json.optLong("minutes", 15).coerceIn(1, 120)
                val start = end.minusSeconds(minutes * 60)
                val records = health.readRecords(ReadRecordsRequest(HeartRateRecord::class, TimeRangeFilter.between(start, end))).records
                val samples = records.flatMap { it.samples }.filter { !it.time.isBefore(start) && !it.time.isAfter(end) }
                val result = if (samples.isEmpty()) JSONObject().put("latest", 0).put("average", 0).put("minimum", 0).put("maximum", 0)
                    else { val bpms=samples.map{it.beatsPerMinute.toInt()}; val latest=samples.maxByOrNull{it.time}; JSONObject().put("latest",latest?.beatsPerMinute?.toInt()?:0).put("average",bpms.average().toInt()).put("minimum",bpms.minOrNull()?:0).put("maximum",bpms.maxOrNull()?:0).put("sampledAt",latest?.time?.toString()) }
                reply.postMessage(JSONObject().put("id", id).put("result", result).toString())
            }
            "getTodaySteps" -> lifecycleScope.launch {
                val zone = ZoneId.systemDefault()
                val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
                val end = java.time.Instant.now()
                val result = health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))
                val steps = result[StepsRecord.COUNT_TOTAL] ?: 0L
                reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("steps", steps)).toString())
            }
        }
    }
}
