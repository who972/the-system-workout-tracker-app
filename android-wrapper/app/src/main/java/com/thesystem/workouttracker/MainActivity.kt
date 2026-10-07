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
    inner class SystemAndroidBridge { @JavascriptInterface fun exportBackup(name: String, json: String) { runOnUiThread { pendingBackupName=name; pendingBackupJson=json; backupLauncher.launch(name) } } }
    private lateinit var webView: WebView
    private lateinit var health: HealthConnectClient
    private var permissionReply: JavaScriptReplyProxy? = null

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val ok = granted.contains(HealthPermission.getReadPermission(StepsRecord::class))
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
                    val permission = HealthPermission.getReadPermission(StepsRecord::class)
                    if (health.permissionController.getGrantedPermissions().contains(permission)) {
                        reply.postMessage(JSONObject().put("id", id).put("result", JSONObject().put("granted", true)).toString())
                    } else {
                        pendingPermissionId = id
                        permissionReply = reply
                        permissionLauncher.launch(setOf(permission))
                    }
                }
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
