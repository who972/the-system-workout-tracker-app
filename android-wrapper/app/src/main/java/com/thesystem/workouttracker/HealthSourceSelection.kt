package com.thesystem.workouttracker

import java.time.Instant
import java.time.Duration

data class SourceInterval(val source: String, val start: Instant, val end: Instant, val watch: Boolean = false)

// Pick the source covering the largest part of the day, then the newest ending
// sample, then package name for stable ties. Never sum providers together.
fun chooseHealthSource(records: List<SourceInterval>, start: Instant, end: Instant): String? {
    data class Candidate(val source: String, val coverage: Long, val latest: Instant)
    return records.groupBy { it.source }.mapNotNull { (source, rows) ->
        val intervals = rows.map { maxOf(it.start, start) to minOf(it.end, end) }.filter { !it.second.isBefore(it.first) }.sortedBy { it.first }
        if (intervals.isEmpty()) return@mapNotNull null
        var left = intervals.first().first
        var right = intervals.first().second
        var coverage = 0L
        for ((a, b) in intervals.drop(1)) {
            if (!a.isAfter(right)) right = maxOf(right, b)
            else { coverage += Duration.between(left, right).toMillis(); left = a; right = b }
        }
        coverage += Duration.between(left, right).toMillis()
        Candidate(source, coverage, intervals.maxOf { it.second })
    }.sortedWith(compareByDescending<Candidate> { it.coverage }.thenByDescending { it.latest }.thenBy { it.source }).firstOrNull()?.source
}

fun chooseStepSource(records: List<SourceInterval>, start: Instant, end: Instant): String? {
    val inDay = records.filter { it.end.isAfter(start) && it.start.isBefore(end) }
    val watch = inDay.filter { it.watch }
    return chooseHealthSource(watch.ifEmpty { inDay }, start, end)
}
