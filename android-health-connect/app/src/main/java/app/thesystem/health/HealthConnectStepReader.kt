package app.thesystem.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.ZoneId

class HealthConnectStepReader(private val context: Context) {
    companion object {
        val permissions = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        )
    }

    fun availability(): Int = HealthConnectClient.getSdkStatus(context)

    private fun client(): HealthConnectClient {
        check(availability() == HealthConnectClient.SDK_AVAILABLE) { "Health Connect unavailable" }
        return HealthConnectClient.getOrCreate(context)
    }

    suspend fun hasPermission(): Boolean =
        client().permissionController.getGrantedPermissions().containsAll(permissions)

    suspend fun todayMetrics(): HealthDayMetrics {
        val client = client()
        if (!client.permissionController.getGrantedPermissions().containsAll(permissions)) {
            throw SecurityException("Health permissions required")
        }
        val day = StepDay.at(Instant.now(), ZoneId.systemDefault())
        val aggregate = client.aggregate(AggregateRequest(
            metrics = setOf(StepsRecord.COUNT_TOTAL),
            timeRangeFilter = TimeRangeFilter.between(day.start, day.end)
        ))
        val sessions = client.readRecords(ReadRecordsRequest(
            recordType = ExerciseSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(day.start, day.end)
        )).records
        val activeSeconds = sessions.sumOf { session ->
            val start = if (session.startTime.isBefore(day.start)) day.start else session.startTime
            val end = if (session.endTime.isAfter(day.end)) day.end else session.endTime
            kotlin.math.max(0L, java.time.Duration.between(start, end).seconds)
        }
        return HealthDayMetrics(day.date.toString(), aggregate[StepsRecord.COUNT_TOTAL] ?: 0L, activeSeconds / 60L)
    }

    suspend fun todaySteps(): StepTotal {
        val client = client()
        if (!client.permissionController.getGrantedPermissions().containsAll(permissions)) {
            throw SecurityException("Steps permission required")
        }
        val day = StepDay.at(Instant.now(), ZoneId.systemDefault())
        val result = client.aggregate(AggregateRequest(
            metrics = setOf(StepsRecord.COUNT_TOTAL),
            timeRangeFilter = TimeRangeFilter.between(day.start, day.end)
        ))
        return StepTotal(day.date.toString(), result[StepsRecord.COUNT_TOTAL] ?: 0L)
    }
}

data class StepTotal(val date: String, val steps: Long)


data class HealthDayMetrics(val date: String, val steps: Long, val activeMinutes: Long)
