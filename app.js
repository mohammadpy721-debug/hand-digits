(() => {
  const $ = id => document.getElementById(id);
  const video = $('video'), overlay = $('overlay'), octx = overlay.getContext('2d');
  const trail = $('trail'), tctx = trail.getContext('2d');
  const fx = $('fx'), fctx = fx.getContext('2d');
  const status = $('status'), fingerOut = $('finger'), writeOut = $('write'), hint = $('hint');
  const historyEl = $('history'), scoreEl = $('score'), targetEl = $('target'), gameBtn = $('game');

  // ---------- Sound (WebAudio, no files) ----------
  let audio = null;
  function beep(freq = 660, dur = 0.12, type = 'sine') {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  // ---------- Particles (confetti + glow sparks) ----------
  const particles = [];
  function burst(x, y, n = 60, palette = ['#c084fc', '#22d3ee', '#f472b6', '#facc15']) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1, c: palette[i % palette.length], r: 2 + Math.random() * 3 });
    }
  }
  function spark(x, y) { particles.push({ x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 0.6, c: '#e9d5ff', r: 2 }); }
  function tickFx() {
    fctx.clearRect(0, 0, fx.width, fx.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.018;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      fctx.globalAlpha = Math.max(0, p.life);
      fctx.fillStyle = p.c; fctx.shadowColor = p.c; fctx.shadowBlur = 12;
      fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); fctx.fill();
    }
    fctx.globalAlpha = 1;
    requestAnimationFrame(tickFx);
  }

  // ---------- Finger counting ----------
  const TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18];
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function countFingers(lm) {
    const w = lm[0];
    let n = 0;
    if (d2(w, lm[4]) > d2(w, lm[3]) * 1.1) n++;
    for (let i = 0; i < 4; i++) if (d2(w, lm[TIPS[i]]) > d2(w, lm[PIPS[i]]) * 1.15) n++;
    return n;
  }
  const history = [];
  let shownDigit = null;
  function pushDigit(v) {
    history.push(v); if (history.length > 10) history.shift();
    const counts = {};
    for (const x of history) counts[x] = (counts[x] || 0) + 1;
    const [best, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (history.length >= 6 && c >= 7) {
      if (shownDigit !== +best) { shownDigit = +best; fingerOut.classList.remove('pop'); void fingerOut.offsetWidth; fingerOut.classList.add('pop'); }
    }
    fingerOut.textContent = shownDigit === null ? '–' : shownDigit;
  }

  // ---------- Game mode ----------
  let game = null; // {target, score, streak, holdSince}
  function newTarget() { game.target = Math.floor(Math.random() * 11); targetEl.textContent = game.target; game.holdSince = 0; }
  function toggleGame() {
    if (game) { game = null; gameBtn.textContent = 'حالت بازی'; $('gamebox').style.display = 'none'; return; }
    game = { target: 0, score: 0, streak: 0, holdSince: 0 };
    $('gamebox').style.display = 'block';
    scoreEl.textContent = '0';
    gameBtn.textContent = 'پایان بازی';
    newTarget();
  }
  function checkGame(total, now) {
    if (!game) return;
    if (shownDigit === game.target) {
      if (!game.holdSince) game.holdSince = now;
      if (now - game.holdSince > 700) {
        game.score += 1; game.streak += 1;
        scoreEl.textContent = game.score;
        burst(fx.width / 2, fx.height / 2, 90);
        beep(880, 0.15, 'triangle');
        newTarget();
      }
    } else game.holdSince = 0;
  }

  // ---------- Air writing ----------
  const STROKE_END_MS = 1100;
  let stroke = [], lastDrawAt = 0, pointing = false;
  function isPointing(lm) {
    const index = d2(lm[0], lm[8]) > d2(lm[0], lm[6]) * 1.15;
    const middle = d2(lm[0], lm[12]) > d2(lm[0], lm[10]) * 1.15;
    const ring = d2(lm[0], lm[16]) > d2(lm[0], lm[14]) * 1.15;
    return index && !middle && !ring;
  }
  function drawTrail(now) {
    tctx.clearRect(0, 0, trail.width, trail.height);
    if (stroke.length < 2) return;
    tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      tctx.lineWidth = pass ? 4 : 14;
      tctx.strokeStyle = pass ? '#ffffff' : 'rgba(168,85,247,.55)';
      tctx.shadowColor = '#c084fc'; tctx.shadowBlur = pass ? 10 : 24;
      tctx.beginPath();
      stroke.forEach((p, i) => { const x = p.x * trail.width, y = p.y * trail.height; i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); });
      tctx.stroke();
    }
  }
  function finishStroke() {
    if (stroke.length > 12) {
      const pts = stroke.map(p => ({ x: p.x * 500, y: p.y * 500 }));
      const r = ONE.recognize(pts, TEMPLATES);
      const ok = r.score > 0.55;
      const label = ok ? r.name : '?';
      writeOut.textContent = label;
      writeOut.title = `اطمینان ${(r.score * 100).toFixed(0)}٪`;
      hint.textContent = ok ? `تشخیص: ${label} (اطمینان ${(r.score * 100).toFixed(0)}٪)` : 'مطمئن نشدم. دوباره بنویس.';
      if (ok) {
        addHistory(label);
        const x = fx.width / 2, y = fx.height / 3;
        burst(x, y, 50, ['#facc15', '#f472b6', '#22d3ee']);
        beep(660, 0.12, 'sine');
      } else beep(220, 0.1, 'square');
    }
    stroke = [];
    tctx.clearRect(0, 0, trail.width, trail.height);
  }
  function addHistory(label) {
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.textContent = label;
    historyEl.prepend(chip);
    while (historyEl.children.length > 30) historyEl.removeChild(historyEl.lastChild);
  }
  function clearAll() {
    stroke = []; tctx.clearRect(0, 0, trail.width, trail.height);
    writeOut.textContent = '–'; hint.textContent = 'پاک شد.';
    burst(fx.width / 2, fx.height / 2, 40, ['#94a3b8', '#e2e8f0']);
    beep(330, 0.1, 'sine');
  }

  // ---------- MediaPipe ----------
  const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  const PALETTE = ['#a855f7','#c084fc','#22d3ee','#f472b6','#facc15','#4ade80','#fb923c','#60a5fa','#e879f9','#34d399','#f87171'];
  let fistSince = 0;

  function onResults(res) {
    const w = overlay.width, h = overlay.height;
    const now = performance.now();
    octx.clearRect(0, 0, w, h);
    let total = 0, pointer = null;
    const color = PALETTE[(shownDigit ?? 0) % PALETTE.length];

    (res.multiHandLandmarks || []).forEach(lm => {
      total += countFingers(lm);
      octx.strokeStyle = color; octx.lineWidth = 3; octx.shadowColor = color; octx.shadowBlur = 14;
      for (const [a, b] of HAND_CONNECTIONS) {
        octx.beginPath(); octx.moveTo((1 - lm[a].x) * w, lm[a].y * h); octx.lineTo((1 - lm[b].x) * w, lm[b].y * h); octx.stroke();
      }
      octx.fillStyle = '#ffffff'; octx.shadowBlur = 12;
      for (const p of lm) { octx.beginPath(); octx.arc((1 - p.x) * w, p.y * h, 4, 0, Math.PI * 2); octx.fill(); }
      if (!pointer && isPointing(lm)) pointer = lm[8];
    });
    octx.shadowBlur = 0;

    pushDigit(total);
    checkGame(total, now);

    if (pointer) {
      pointing = true; lastDrawAt = now;
      stroke.push({ x: 1 - pointer.x, y: pointer.y });
      if (Math.random() < 0.5) spark((1 - pointer.x) * fx.width, pointer.y * fx.height);
      drawTrail(now);
    } else if (pointing && now - lastDrawAt > STROKE_END_MS) {
      pointing = false; finishStroke();
    }

    if (total === 0 && res.multiHandLandmarks && res.multiHandLandmarks.length === 1 && !pointer) {
      if (!fistSince) fistSince = now;
      if (now - fistSince > 1200) { clearAll(); fistSince = 0; }
    } else fistSince = 0;
  }

  const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(max-width:700px)').matches;

  function start() {
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      status.textContent = 'کتابخانه‌ی MediaPipe لود نشد. اینترنت یا CDN رو چک کن.'; return;
    }
    const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: IS_MOBILE ? 0 : 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);

    let busy = false; // skip frames while the previous one is still processing (keeps phones responsive)
    const cam = new Camera(video, {
      onFrame: async () => {
        if (busy) return;
        busy = true;
        try { await hands.send({ image: video }); } finally { busy = false; }
      },
      width: IS_MOBILE ? 480 : 640,
      height: IS_MOBILE ? 360 : 480,
      facingMode: 'user'
    });
    cam.start().then(() => { status.textContent = 'دوربین فعاله. دستت رو جلوی دوربین بگیر.'; beep(520, 0.1, 'triangle'); })
      .catch(() => { status.textContent = 'دسترسی به دوربین داده نشد. تو تنظیمات مرورگر اجازه‌ی دوربین رو بده.'; });
  }

  // Keep the stage the same shape as the camera feed, so the video, skeleton and trail line up on every screen size
  video.addEventListener('loadedmetadata', () => {
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    document.querySelector('.stage').style.aspectRatio = `${vw} / ${vh}`;
    overlay.width = vw; overlay.height = vh;
    trail.width = vw; trail.height = vh;
  });

  const TEMPLATES = Object.entries(STROKES).map(([n, p]) => ONE.makeTemplate(n, p.map(([x, y]) => ({ x: x * 5, y: y * 5 }))));

  function sizeFx() { fx.width = fx.clientWidth * 2; fx.height = fx.clientHeight * 2; }
  window.addEventListener('resize', sizeFx); sizeFx(); requestAnimationFrame(tickFx);

  $('clear').addEventListener('click', clearAll);
  $('game').addEventListener('click', toggleGame);
  $('start').addEventListener('click', e => { e.target.disabled = true; start(); });
})();
