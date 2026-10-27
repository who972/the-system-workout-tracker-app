# v0.89 — Voice requests across the app

The on-device assistant now provides an in-app Help / All Requests catalog. It recognizes natural variants for app navigation, custom training, workout controls, progress, health, fuel, social and settings.

- “Can I do a custom exercise?” opens the custom exercise form.
- “Let me do a 15-minute walk” prepares a Workout Builder draft after confirmation. “I want to walk” followed by “15 minutes” also works. It does not claim completion or award XP.
- Library searches can apply supported equipment or muscle keywords.
- Starting or resuming, switching session equipment, changing available session time, logging a set, preparing effort feedback and exiting require confirmation.
- Set requests support repetitions and seconds, check the current exercise unit, and retain existing workout validation. Kilogram entries are sent back for review because live workout loads use pounds.
- Current-set confirmations expire and are rejected if the active set changes. Cancellation and repeated confirmation cannot duplicate a saved log.
- Rest/timed-set controls, remaining sets, movement guides and current-exercise weight guidance use existing workout state.
- Pain requests pause countdown/rest without recording a set or prescribing a substitute. Incomplete workouts cannot be finished for XP by voice.
- Profile changes, backups/imports, social hosting/joining and custom mission saving open their existing review controls; voice does not silently save settings, export data, send invitations or start shared sessions.
- Destructive operations remain unavailable through voice.
- Unknown requests explain available features. Help contains clickable example requests and categories.

This is local command recognition, not an open-ended language model. Follow-up context is limited to the current dialog, expires, and is cleared on closing. Microphone transcription and talk-back still depend on Android’s available speech services. Real-device speech recognition must be checked on the phone; simulated speech events test app behavior.
