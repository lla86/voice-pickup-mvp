# Voice Pickup MVP v0.1

A phone-first, no-backend prototype for recognizing spoken English pickup numbers and displaying them prominently. Intended for controlled tests of a human-called food-court pickup workflow. Designed for iPhone Safari and Android Chrome (actual browser/device compatibility must be tested).

## Features
- Start/stop microphone speech recognition in a mobile browser using Web Speech API.
- Displays the latest recognized number and recent five calls.
- English number parser: `Order 125`, `one twenty five`, `one two five`, `one hundred twenty five`, `one oh five`, and more.
- Rejects longer unrelated sentences; optional strict mode requiring `Order`, `Number`, etc.
- Filters repeated *live* calls with same number within 35 seconds.
- Recovers from common recognition-session endings (while page is in foreground) and reports errors.
- Manual correct/wrong review, manually count missed calls, export records as CSV.
- Demo call generator and text-parser test without microphone.
- No server, account, paid API key, audio archive, or localStorage. CSV stays on the phone until exported.

## Deploy to your phone with HTTPS

### GitHub Pages (simplest)
1. Create a GitHub repository, e.g. `voice-pickup-mvp` (a public repository works on GitHub Free; **don't upload private data**).
2. Upload `index.html`, `styles.css`, `app.js` and `parser.mjs` to the **repository root** (not in another folder). `README.md` and tests are optional for deployment.
3. Under repository **Settings → Pages**, choose **Deploy from a branch**, select `main`, directory `/(root)`, and Save.
4. Open the GitHub Pages address shown there on **Android Chrome** or **iPhone Safari**. Use a normal browser, not an embedded social-app browser. HTTPS is required for permissions.
5. Tap **开始监听 / Start** and grant microphone / speech recognition permission if requested. Keep the screen awake and browser visible.
6. Let staff shout numbers naturally; compare the latest number on screen to what you heard, tap correct/wrong, or log a missed call. Export CSV after the test.

### Local developer smoke-test
Run `python3 -m http.server 8000` from the project directory and browse to `http://localhost:8000` on your *computer*. The `localhost` origin is treated as a secure context by modern browsers. Do not assume that `http://<computer LAN IP>:8000` will provide microphone access on a separate phone: use HTTPS for phone testing.

## Important technical limitations

- Web Speech API availability varies by operating system and browser. Support checks at startup are not a guarantee of working recognition.
- Some browsers send voice audio to a remote speech recognition service (Chrome's implementation can do this). **This prototype does not save or upload audio itself**, but it does not promise offline/private-on-device recognition. Get appropriate permission for real-world testing.
- Web Speech API does **not offer reliable portable microphone-source selection**. A compatible USB-C / Lightning / wireless microphone may be selected automatically by the operating system, but the prototype cannot force the ASR engine to use it. Verify your hardware setup through actual tests.
- Mobile OSes may stop microphone or recognition when a tab goes to the background, screen locks, or recognition times out. The app attempts session re-start while in the foreground; this is best-effort, not guaranteed continuous 24/7 listening.
- The display is an *assistant*, not an authoritative restaurant order-status system: it cannot read the POS, confirm an order exists, or replace employee calls.
- The version deliberately does not implement audio-level gating or beamforming; browser-provided ASR does not expose enough stable audio routing to guarantee that an RMS threshold applies to its exact input. Future native/local ASR versions may implement this.
- Incorrect transcript like "129" instead of "125" can pass number grammar checks; only real data can measure transcription reliability.
- Event information is kept **in memory only** and lost on reload; export before closing. It stores the recognized number, not raw speech transcripts/audio. A transient last-transcript is shown solely for debugging.
- For public or private premises, follow location policies and avoid recording customer conversations. Get the operator's permission for extended audio tests.

## Metrics
- **真实识别次数**: unique live recognized numbers (not demo calls or recognized duplicates within the debounce window).
- **已评估正确率**: correct / (correct + wrong + manually logged missed) across records that have been reviewed. Unreviewed and demo records are excluded. This is a manual field metric, not a statistical confidence estimate.
- **漏识别**: manually entered missed calls. Please count actual calls in the environment independently to avoid skewing the denominator.

## Tests
Requires Node 18+: `node tests/parser.test.mjs`

## Source layout
```
index.html           Mobile UI
styles.css           Visual design + responsive layout
app.js               Browser ASR session, UI, reviewing, CSV export
parser.mjs           Stateless speech-to-order-number parser
tests/parser.test.mjs Number parsing unit tests
README.md            Deployment, testing and privacy guidance
```
