package app.thesystem.health

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Use a calendar-day boundary, not a rolling 24 hours (DST days can be 23 or 25 hours). */
data class StepDay(val date: LocalDate, val start: Instant, val end: Instant) {
    companion object {
        fun at(now: Instant, zone: ZoneId): StepDay {
            val date = now.atZone(zone).toLocalDate()
            return StepDay(date, date.atStartOfDay(zone).toInstant(), now)
        }
    }
}
