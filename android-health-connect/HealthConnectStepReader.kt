package app.thesystem.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class HealthConnectStepReader(context: Context) {
    private val client = HealthConnectClient.getOrCreate(context)
    val readStepsPermission = HealthPermission.getReadPermission(StepsRecord::class)

    suspend fun hasPermission() =
        client.permissionController.getGrantedPermissions().contains(readStepsPermission)

    suspend fun todaySteps(): Long {
        if (!hasPermission()) return 0
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val result = client.aggregate(AggregateRequest(
            metrics = setOf(StepsRecord.COUNT_TOTAL),
            timeRangeFilter = TimeRangeFilter.between(start, Instant.now())
        ))
        return result[StepsRecord.COUNT_TOTAL] ?: 0
    }
}
