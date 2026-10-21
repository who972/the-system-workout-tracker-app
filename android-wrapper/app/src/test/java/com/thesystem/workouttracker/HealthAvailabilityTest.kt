package com.thesystem.workouttracker

import org.junit.Assert.*
import org.junit.Test

class HealthAvailabilityTest {
    @Test fun missingProviderDoesNotConstructClient() {
        var called = false
        val client = optionalHealthClient({ false }) { called = true; "client" }
        assertNull(client)
        assertFalse(called)
    }
    @Test fun providerStatusFailureDoesNotBlockStartup() {
        assertNull(optionalHealthClient<String>({ throw IllegalStateException("unavailable") }) { "client" })
    }
    @Test fun providerDisappearingDuringConstructionDoesNotBlockStartup() {
        assertNull(optionalHealthClient<String>({ true }) { throw UnsupportedOperationException("unavailable") })
    }
    @Test fun availableProviderReturnsClient() {
        assertEquals("client", optionalHealthClient({ true }) { "client" })
    }
}
