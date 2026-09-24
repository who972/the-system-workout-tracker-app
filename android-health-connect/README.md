# The System Android Health Connect bridge

This scaffold connects the existing Step Hunter provider to a future Android WebView host.

Web contract exposed as `window.AndroidHealthConnect`:
- `requestStepPermission()`
- `getTodaySteps()`

Only read access to Steps is required. Keep manual entry as the fallback when the native bridge is unavailable. Use Health Connect aggregate totals so multiple step sources are not double-counted.
