package com.thesystem.workouttracker

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CancellationException
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId

/** Calendar days, not 24-hour slices: daylight-saving days can be 23 or 25 hours. */
internal data class HealthHistoryRange(val dates: List<LocalDate>, val start: LocalDateTime, val end: LocalDateTime) {
    companion object {
        fun create(days: Int, now: Instant, zone: ZoneId): HealthHistoryRange {
            require(days in setOf(7, 14, 30)) { "unsupported-history-range" }
            val end = LocalDateTime.ofInstant(now, zone)
            val dates = (days - 1 downTo 0).map { end.toLocalDate().minusDays(it.toLong()) }
            return HealthHistoryRange(dates, dates.first().atStartOfDay(), end)
        }
    }
}

internal class HealthHistoryReader(private val health: HealthConnectClient) {
    suspend fun read(days: Int): JSONObject {
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val range = HealthHistoryRange.create(days, now, zone)
        val granted = health.permissionController.getGrantedPermissions()
        val errors = JSONObject()
        // Fill omitted buckets with null, preserving a genuine recorded zero.
        val rows = range.dates.associateWith { date ->
            JSONObject().put("date", date.toString()).put("partial", date == range.end.toLocalDate())
        }
        readMetric("steps", HealthPermission.getReadPermission(StepsRecord::class), StepsRecord.COUNT_TOTAL, { it }, range, granted, rows, errors)
        readMetric("activeCalories", HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class), ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, { it.inKilocalories }, range, granted, rows, errors)
        readMetric("totalCalories", HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class), TotalCaloriesBurnedRecord.ENERGY_TOTAL, { it.inKilocalories }, range, granted, rows, errors)
        readMetric("distanceMeters", HealthPermission.getReadPermission(DistanceRecord::class), DistanceRecord.DISTANCE_TOTAL, { it.inMeters }, range, granted, rows, errors)
        readMetric("heartRateAverage", HealthPermission.getReadPermission(HeartRateRecord::class), HeartRateRecord.BPM_AVG, { it }, range, granted, rows, errors)
        readMetric("activeMinutes", HealthPermission.getReadPermission(ExerciseSessionRecord::class), ExerciseSessionRecord.EXERCISE_DURATION_TOTAL, { it.toMillis() / 60000.0 }, range, granted, rows, errors)
        readMetric("sleepMinutes", HealthPermission.getReadPermission(SleepSessionRecord::class), SleepSessionRecord.SLEEP_DURATION_TOTAL, { it.toMillis() / 60000.0 }, range, granted, rows, errors)
        return JSONObject().put("days", days).put("date", range.end.toLocalDate().toString())
            .put("timeZone", zone.id).put("syncedAt", now.toString())
            .put("daily", JSONArray(rows.values.toList())).put("errors", errors)
    }

    private suspend fun <T : Any> readMetric(
        key: String, permission: String, metric: AggregateMetric<T>, convert: (T) -> Number,
        range: HealthHistoryRange, granted: Set<String>, rows: Map<LocalDate, JSONObject>, errors: JSONObject
    ) {
        rows.values.forEach { it.put(key, JSONObject.NULL) }
        if (permission !in granted) { errors.put(key, "permission-required"); return }
        try {
            // Health Connect applies the user's source priorities and deduplicates activity/sleep.
            val buckets = health.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(
                metrics = setOf(metric), timeRangeFilter = TimeRangeFilter.between(range.start, range.end),
                timeRangeSlicer = Period.ofDays(1)
            ))
            buckets.forEach { bucket ->
                bucket.result[metric]?.let { value -> rows[bucket.startTime.toLocalDate()]?.put(key, convert(value)) }
            }
        } catch (e: CancellationException) { throw e
        } catch (e: Exception) {
            rows.values.forEach { it.put(key, JSONObject.NULL) }
            errors.put(key, if (e is SecurityException) "permission-required" else "health-read-failed")
        }
    }
}
