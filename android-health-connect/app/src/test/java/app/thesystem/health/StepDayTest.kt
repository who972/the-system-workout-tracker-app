package app.thesystem.health

import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class StepDayTest {
    @Test fun usesLocalDateInsteadOfUtcDate() {
        val day = StepDay.at(Instant.parse("2026-09-25T02:00:00Z"), ZoneId.of("America/Chicago"))
        assertEquals("2026-09-24", day.date.toString())
        assertEquals(Instant.parse("2026-09-24T05:00:00Z"), day.start)
        assertEquals(Instant.parse("2026-09-25T02:00:00Z"), day.end)
    }

    @Test fun springForwardStartsAtMidnightBeforeOffsetChange() {
        val day = StepDay.at(Instant.parse("2026-03-08T20:00:00Z"), ZoneId.of("America/Chicago"))
        assertEquals(Instant.parse("2026-03-08T06:00:00Z"), day.start)
    }

    @Test fun fallBackIncludesBothRepeatedHours() {
        val day = StepDay.at(Instant.parse("2026-11-01T20:00:00Z"), ZoneId.of("America/Chicago"))
        assertEquals(Instant.parse("2026-11-01T05:00:00Z"), day.start)
    }

    @Test fun recalculatesAfterTimezoneChange() {
        val now = Instant.parse("2026-09-25T02:00:00Z")
        val day = StepDay.at(now, ZoneId.of("Asia/Tokyo"))
        assertEquals("2026-09-25", day.date.toString())
        assertEquals(Instant.parse("2026-09-24T15:00:00Z"), day.start)
    }
}
