package com.thesystem.workouttracker

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val policy = TextView(this).apply {
            text = "THE SYSTEM — HEALTH DATA\n\nWith your permission, The System reads steps, exercise sessions, active and total calories, heart rate, distance and sleep from Health Connect to show your fitness telemetry. Samsung Health can supply synced Galaxy Watch data.\n\nPhase 1 reads only when you open or refresh the health panel, or sync steps. Health data is displayed on this device; step totals are saved locally for side missions. This integration does not upload health records, write to Health Connect, or award workout XP.\n\nYou can choose individual permissions and revoke them in Health Connect settings. Manual steps and solo workouts remain available."
            textSize = 18f
            setPadding(32, 32, 32, 32)
        }
        setContentView(ScrollView(this).apply { addView(policy) })
    }
}
