package com.thesystem.workouttracker

import android.os.Bundle
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
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) = loader.shouldInterceptRequest(request.url)
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
