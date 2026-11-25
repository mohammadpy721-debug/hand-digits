(() => {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const octx = overlay.getContext('2d');
  const trail = document.getElementById('trail');
  const tctx = trail.getContext('2d');
  const status = document.getElementById('status');
  const fingerOut = document.getElementById('finger');
  const writeOut = document.getElementById('write');
  const hint = document.getElementById('hint');

  // --- Finger counting -------------------------------------------------------
  const TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18];
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function countFingers(lm) {
    const wrist = lm[0];
    let n = 0;
    // Thumb: tip further from wrist than its IP joint
    if (d2(wrist, lm[4]) > d2(wrist, lm[3]) * 1.1) n++;
    for (let i = 0; i < 4; i++) if (d2(wrist, lm[TIPS[i]]) > d2(wrist, lm[PIPS[i]]) * 1.15) n++;
    return n;
  }

  const history = []; // smoothing buffer for displayed digit
  let shownDigit = null;
  function pushDigit(v) {
    history.push(v); if (history.length > 10) history.shift();
    const counts = {};
    for (const x of history) counts[x] = (counts[x] || 0) + 1;
    const [best, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (history.length >= 6 && c >= 7) shownDigit = +best;
    fingerOut.textContent = shownDigit === null ? '–' : shownDigit;
  }

  // --- Air writing -----------------------------------------------------------
  const STROKE_END_MS = 1100;
  let stroke = [];          // points in mirrored canvas space (0..1)
  let lastDrawAt = 0;
  let pointing = false;
  let lastResult = null;

  function isPointing(lm) {
    const index = d2(lm[0], lm[8]) > d2(lm[0], lm[6]) * 1.15;
    const middle = d2(lm[0], lm[12]) > d2(lm[0], lm[10]) * 1.15;
    const ring = d2(lm[0], lm[16]) > d2(lm[0], lm[14]) * 1.15;
    return index && !middle && !ring;
  }

  function finishStroke() {
    if (stroke.length > 12) {
      // Normalize to the canvas size used by the recognizer
      const pts = stroke.map(p => ({ x: p.x * 500, y: p.y * 500 }));
      const r = ONE.recognize(pts, TEMPLATES);
      const label = r.score > 0.55 ? r.name : '?';
      lastResult = { label, score: r.score };
      writeOut.textContent = label;
      writeOut.title = `confidence ${(r.score * 100).toFixed(0)}%`;
      hint.textContent = `تشخیص: ${label} (اطمینان ${(r.score * 100).toFixed(0)}٪)`;
    }
    stroke = [];
    tctx.clearRect(0, 0, trail.width, trail.height);
  }

  function clearAll() {
    stroke = []; tctx.clearRect(0, 0, trail.width, trail.height);
    writeOut.textContent = '–'; hint.textContent = 'پاک شد.'; lastResult = null;
  }

  function drawTrail() {
    tctx.clearRect(0, 0, trail.width, trail.height);
    if (stroke.length < 2) return;
    tctx.lineWidth = 10; tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    tctx.strokeStyle = '#c084fc'; tctx.shadowColor = '#a855f7'; tctx.shadowBlur = 16;
    tctx.beginPath();
    stroke.forEach((p, i) => { const x = p.x * trail.width, y = p.y * trail.height; i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); });
    tctx.stroke();
  }

  // --- MediaPipe -------------------------------------------------------------
  function onResults(res) {
    const w = overlay.width = video.videoWidth || 640;
    const h = overlay.height = video.videoHeight || 480;
    octx.save(); octx.clearRect(0, 0, w, h);
    let total = 0;
    let pointer = null;

    (res.multiHandLandmarks || []).forEach(lm => {
      total += countFingers(lm);
      // Draw skeleton (mirrored to match the flipped video)
      octx.strokeStyle = '#a855f7'; octx.lineWidth = 3; octx.shadowColor = '#c084fc'; octx.shadowBlur = 10;
      for (const [a, b] of HAND_CONNECTIONS) {
        octx.beginPath(); octx.moveTo((1 - lm[a].x) * w, lm[a].y * h); octx.lineTo((1 - lm[b].x) * w, lm[b].y * h); octx.stroke();
      }
      octx.fillStyle = '#22d3ee';
      for (const p of lm) { octx.beginPath(); octx.arc((1 - p.x) * w, p.y * h, 4, 0, Math.PI * 2); octx.fill(); }
      if (!pointer && isPointing(lm)) pointer = lm[8];
    });
    octx.restore();

    pushDigit(total);

    const now = performance.now();
    if (pointer) {
      pointing = true; lastDrawAt = now;
      stroke.push({ x: 1 - pointer.x, y: pointer.y });
      drawTrail();
    } else if (pointing && now - lastDrawAt > STROKE_END_MS) {
      pointing = false; finishStroke();
    }

    // Fist (no fingers) clears the board
    if (total === 0 && res.multiHandLandmarks && res.multiHandLandmarks.length === 1 && !pointer) {
      // only clear after the fist is held briefly, to avoid accidental resets
      if (!onResults.fistSince) onResults.fistSince = now;
      if (now - onResults.fistSince > 1200) { clearAll(); onResults.fistSince = 0; }
    } else onResults.fistSince = 0;
  }

  const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

  function start() {
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      status.textContent = 'کتابخانه‌ی MediaPipe لود نشد. اینترنت یا CDN رو چک کن.'; return;
    }
    const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);
    const cam = new Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width: 640, height: 480
    });
    cam.start().then(() => { status.textContent = 'دوربین فعاله. دستت رو جلوی دوربین بگیر.'; })
      .catch(() => { status.textContent = 'دسترسی به دوربین داده نشد.'; });
  }

  document.getElementById('clear').addEventListener('click', clearAll);
  document.getElementById('start').addEventListener('click', e => { e.target.disabled = true; start(); });
  // Templates from templates.js, recognizer from recognizer.js
  const TEMPLATES = Object.entries(STROKES).map(([n, p]) => ONE.makeTemplate(n, p.map(([x, y]) => ({ x: x * 5, y: y * 5 }))));
})();
