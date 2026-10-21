package com.thesystem.workouttracker

// Device/provider checks and client construction may both fail; health is optional.
internal fun <T> optionalHealthClient(available: () -> Boolean, create: () -> T): T? =
    runCatching { if (available()) create() else null }.getOrNull()
