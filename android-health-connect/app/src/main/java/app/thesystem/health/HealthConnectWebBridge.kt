package app.thesystem.health

import androidx.core.net.toUri
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Origin-restricted async transport. Never expose health data to external pages or frames. */
class HealthConnectWebBridge(private val activity: ComponentActivity) {
    private val reader = HealthConnectStepReader(activity.applicationContext)
    private var permissionReply: ((JSONObject) -> Unit)? = null
    private val permissionLauncher = activity.registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val reply = permissionReply
        permissionReply = null
        reply?.invoke(JSONObject().put("granted", granted.containsAll(HealthConnectStepReader.permissions)))
    }

    fun attach(webView: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, "SystemHealthNative", setOf(MainActivity.ORIGIN)) {
                _, message, sourceOrigin, isMainFrame, reply ->
            if (isMainFrame && sourceOrigin == MainActivity.ORIGIN.toUri()) {
                receive(message.data, reply)
            }
        }
    }

    private fun receive(raw: String?, proxy: JavaScriptReplyProxy) {
        val request = runCatching { JSONObject(raw ?: "") }.getOrNull() ?: return
        val id = request.optString("id")
        if (id.isBlank() || id.length > 100) return
        val respond: (JSONObject) -> Unit = { result ->
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                proxy.postMessage(JSONObject().put("id", id).put("result", result).toString())
            }
        }
        activity.lifecycleScope.launch {
            try {
                val availability = reader.availability()
                if (availability != HealthConnectClient.SDK_AVAILABLE) {
                    respond(error(if (availability == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
                        "provider-update-required" else "unavailable"))
                    return@launch
                }
                when (request.optString("method")) {
                    "requestStepPermission" -> {
                        if (reader.hasPermission()) respond(JSONObject().put("granted", true))
                        else if (permissionReply != null) respond(error("permission-request-pending"))
                        else {
                            permissionReply = respond
                            try { permissionLauncher.launch(HealthConnectStepReader.permissions) }
                            catch (e: Exception) { permissionReply = null; throw e }
                        }
                    }
                    "getTodaySteps" -> {
                        val total = reader.todaySteps()
                        respond(JSONObject().put("steps", total.steps).put("date", total.date))
                    }
                    else -> respond(error("unsupported-method"))
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: SecurityException) {
                respond(error("permission-required"))
            } catch (e: Exception) {
                respond(error("read-failed"))
            }
        }
    }

    private fun error(code: String) = JSONObject().put("error", code)
}
