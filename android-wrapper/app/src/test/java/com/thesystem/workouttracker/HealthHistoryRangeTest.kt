package com.thesystem.workouttracker

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.time.Duration

class HealthHistoryRangeTest {
    @Test fun includesExactlyTheRequestedDaysAndStopsAtNow() {
        for (days in listOf(7, 14, 30)) {
            val range = HealthHistoryRange.create(days, Instant.parse("2026-10-02T21:00:00Z"), ZoneId.of("America/Chicago"))
            assertEquals(days, range.dates.size)
            assertEquals("2026-10-02", range.dates.last().toString())
            assertEquals("2026-10-02T16:00", range.end.toString())
            assertEquals(range.dates.first().atStartOfDay(), range.start)
            assertEquals(days, range.dates.distinct().size)
        }
    }
    @Test fun calendarBucketsSurviveBothDaylightSavingTransitions() {
        val zone = ZoneId.of("America/Chicago")
        for ((instant, expectedHours) in listOf("2026-03-10T17:00:00Z" to 23L, "2026-11-03T18:00:00Z" to 25L)) {
            val range = HealthHistoryRange.create(7, Instant.parse(instant), zone)
            val hours = range.dates.zipWithNext().map { (a, b) -> Duration.between(a.atStartOfDay(zone), b.atStartOfDay(zone)).toHours() }
            assertTrue(hours.contains(expectedHours))
            assertEquals(6, hours.size)
        }
    }
    @Test fun usesThePhonesCalendarDateAndRejectsUnboundedRequests() {
        val now = Instant.parse("2026-10-03T02:00:00Z")
        assertEquals("2026-10-02", HealthHistoryRange.create(7, now, ZoneId.of("America/Chicago")).dates.last().toString())
        assertEquals("2026-10-03", HealthHistoryRange.create(7, now, ZoneId.of("Asia/Tokyo")).dates.last().toString())
        for (days in listOf(-1, 0, 1, 31, 365)) {
            try { HealthHistoryRange.create(days, now, ZoneId.of("UTC")); fail("Accepted $days") }
            catch (_: IllegalArgumentException) { }
        }
    }
}
