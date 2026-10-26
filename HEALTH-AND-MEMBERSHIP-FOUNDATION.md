# Health and membership foundation

Status: app completion and sleep tracking take priority. System Plus planning and billing are paused.

## First increment

Use the existing Health Connect reader and per-category permissions. Show an explained local health briefing in Telemetry, the daily briefing and the local assistant. Missing or stale data must not be treated as zero or affect rank. Health context does not change workouts, award XP, or import Samsung proprietary scores.

Samsung Health -> Health Connect -> existing native bridge -> local context -> briefing.

The sleep tracker now reads complete sessions and shared stages, groups by wake date and resolves overlapping providers (Samsung Health preferred). Session duration and time asleep are labeled separately; incomplete stages never become an invented time-asleep total. Seven-day history excludes missing days from averages. Physical Galaxy Watch/phone validation remains required. Calendar-day sleep totals remain labeled separately in the health history.

## Proposed tiers

| Free | System Plus (future) |
| --- | --- |
| Current workouts, rank, assessment and exercise guidance | Adaptive weekly planning with explained suggestions |
| Basic health sync and seven-day dashboard | Longer-term trend comparisons and weekly coaching reports |
| Local voice commands and basic briefing | More coaching workflows and personalization |
| Existing session equipment switching and Train Together | Additional programs and cosmetic customization |
| Data export and account controls | Optional future watch companion features after validation |

Existing functionality stays available. Premium must add recurring value. A paid rank or XP advantage is excluded. Data access, permission controls, deletion and export remain free.

Pricing hypothesis for evaluation: $4.99/month or $39.99/year. Not a published offer. Validate willingness to pay and support/store costs before setting products. Avoid a lifetime promise for features with recurring costs. Cloud generative AI, if added, requires separate cost and quota analysis; the current local assistant has no paid model calls.

## Membership implementation sequence

1. Validate free health syncing and context on physical devices.
2. Build and test one valuable premium feature before advertising it.
3. Select distribution and payment channel. For Google Play distribution, integrate Play Billing with a secure backend that verifies purchase tokens and owns entitlements.
4. Model active, canceled-but-unexpired, grace, hold, expired and revoked states. Handle restore, account switching, duplicate notifications and offline access. Client storage is never proof of purchase.
5. Add store products, restore/manage-subscription UI and clear renewal terms. Test with license testers before enabling sales.

Do not enable billing or lock current features in this increment. Store account setup, final pricing and paid launch remain separate decisions.

## Acceptance and follow-up

- Context refreshes after sync and accurately reports stale or unavailable data.
- The assistant can read the same briefing without a network/model call.
- No health values enter competitive scoring or initial assessment ranking.
- Walking mission credit requires separate idempotent per-day accounting and source reconciliation before activation.
- Live heart rate requires separate watch work; synchronized records are not a live sensor stream.
- Sources: https://developer.samsung.com/health/health-connect-faq.html and https://developer.android.com/google/play/billing/integrate
