# On-site testing checklist (first run)

## Before arriving
- Publish the four web files on an HTTPS site.
- On a phone, open the page in a supported browser and test Demo Mode.
- Try Start in a quiet location, allow microphone permissions, say: "Order number one twenty five" and check for `125`.
- Plug in an external microphone if desired, then test again: the web app cannot force source selection, so verify empirically.

## At the food court
- Remain in an ordinary customer waiting area, follow operator rules, and do not obstruct the service counter.
- If there is no clear permission to record, don't capture/store audio; the app does not record audio itself but the browser ASR vendor may process speech remotely.
- Start Listening with the phone screen awake and browser in the foreground.
- Observe 20-30 actual calls if feasible. Mark each recognized call correct or wrong; tap "Record missed call" once for each missed actual call. If a false positive appears, mark it wrong.
- Repeat with the external microphone under similar positioning/background noise, where permitted.
- Export CSV **before** closing or refreshing the page.

## What to compare
- True call count independently observed vs live recognized records + manually recorded missed calls (consider duplicate calls, multiple staff, and skipped calls).
- Correct numbers / (correct + wrong + missed), *only where fully reviewed*.
- False positive count from conversations unrelated to orders.
- Approximate time lag between call end and on-screen update.
- Recognition reliability when the device is still vs handheld, and with built-in vs external microphone.

## Known limitations
This is a feasibility prototype, not a certified production pickup system. No validated accuracy claims are included, and recognition may be unavailable or interrupted on some OS/browser/network combinations.
