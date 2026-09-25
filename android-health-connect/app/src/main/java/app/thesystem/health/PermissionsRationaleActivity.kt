package app.thesystem.health

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import android.widget.ScrollView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val policy = TextView(this).apply {
            setText(R.string.steps_privacy)
            textSize = 18f
            setPadding(32, 64, 32, 32)
        }
        setContentView(ScrollView(this).apply { addView(policy) })
    }
}
