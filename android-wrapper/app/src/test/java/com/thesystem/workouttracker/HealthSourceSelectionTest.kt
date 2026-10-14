package com.thesystem.workouttracker
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
class HealthSourceSelectionTest {
    private fun t(hours: Long) = Instant.parse("2026-10-13T00:00:00Z").plusSeconds(hours * 3600)
    @Test fun duplicateIntervalsDoNotInflateProviderCoverage() {
        val rows = List(10) { SourceInterval("duplicate", t(0), t(1)) } + SourceInterval("fuller", t(0), t(2))
        assertEquals("fuller", chooseHealthSource(rows, t(0), t(24)))
    }
    @Test fun overlappingIntervalsAreMergedAndClippedToDay() {
        val rows = listOf(SourceInterval("outside", t(-24), t(1)), SourceInterval("continuous", t(0), t(2)), SourceInterval("continuous", t(1), t(3)))
        assertEquals("continuous", chooseHealthSource(rows, t(0), t(24)))
    }
    @Test fun newestCoverageWinsEqualDurationAndTiesAreStable() {
        assertEquals("newer", chooseHealthSource(listOf(SourceInterval("old", t(0), t(2)), SourceInterval("newer", t(2), t(4))), t(0), t(24)))
        val rows = listOf(SourceInterval("b", t(0), t(2)), SourceInterval("a", t(0), t(2)))
        assertEquals("a", chooseHealthSource(rows.reversed(), t(0), t(24)))
    }
    @Test fun missingDataReturnsNoProvider() { assertNull(chooseHealthSource(emptyList(), t(0), t(24))) }
}
