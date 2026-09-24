package app.thesystem.health

import android.webkit.JavascriptInterface
import org.json.JSONObject

class HealthConnectWebBridge(
    private val requestPermission: () -> Unit,
    private val readTodaySteps: () -> Long
) {
    @JavascriptInterface
    fun requestStepPermission(): Boolean {
        requestPermission()
        return true
    }

    @JavascriptInterface
    fun getTodaySteps(): String =
        JSONObject().put("steps", readTodaySteps()).toString()
}
