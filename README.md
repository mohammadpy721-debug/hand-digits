# ✋ Hand Digits

Show numbers with your fingers, or write characters in the air with your index finger. Everything runs in the browser through your webcam.

## Features
- **Finger counting:** shows 0 to 10 using both hands, powered by MediaPipe Hands.
- **Air writing:** point with your index finger to write. After a short pause, the drawn shape is recognized with the $1 Unistroke Recognizer. It needs no training.
- **Clear:** hold a closed fist for about one second.
- Recognizes digits 0 to 9 and all letters A to Z (single-stroke, so letters that need pen lifts, such as E, F, H, or T, work best when drawn in one motion).
- **Game mode:** a random target number appears. Show it with your fingers and hold for 0.7 seconds to score.
- **Effects:** glowing trail, sparks, confetti on success, and sound feedback.
- **History:** recognized characters appear as chips.

## Run it
Open the page over HTTPS, for example on GitHub Pages. Browsers only allow camera access on secure pages. Allow camera access when asked.

## Files
- `index.html`: the full app (open this file)
- `recognizer.js`, `templates.js`, `app.js`: source modules. `index.html` is built from them.
- `test.js`: checks the recognizer on synthetic strokes (`node test.js`). Current accuracy is about 95%. The most common mix-ups are N/Z and 8/H.
