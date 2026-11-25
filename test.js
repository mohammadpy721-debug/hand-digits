const ONE = require('./recognizer.js');
const { STROKES } = (() => { const fs = require('fs'); const src = fs.readFileSync(__dirname + '/templates.js', 'utf8'); return new Function(src + '; return { STROKES };')(); })();
const interp = (pts, n = 40) => { const out = []; const seg = pts.length - 1; for (let i = 0; i < n; i++) { const t = i / (n - 1) * seg; const k = Math.min(Math.floor(t), seg - 1), f = t - k; out.push({ x: pts[k][0] + f * (pts[k + 1][0] - pts[k][0]), y: pts[k][1] + f * (pts[k + 1][1] - pts[k][1]) }); } return out; };
const templates = Object.entries(STROKES).map(([n, p]) => ONE.makeTemplate(n, interp(p)));
let ok = 0, total = 0; const misses = {};
for (const [name, pts] of Object.entries(STROKES)) {
  for (let trial = 0; trial < 8; trial++) {
    const ang = (Math.random() - 0.5) * 0.3, sc = 0.7 + Math.random() * 0.6;
    const raw = interp(pts, 50).map(p => { const cx = p.x - 50, cy = p.y - 50; return { x: (cx * Math.cos(ang) - cy * Math.sin(ang)) * sc + 100 + (Math.random() - 0.5) * 4, y: (cx * Math.sin(ang) + cy * Math.cos(ang)) * sc + 100 + (Math.random() - 0.5) * 4 }; });
    const r = ONE.recognize(raw, templates); total++;
    if (r.name === name) ok++; else misses[name] = (misses[name] || '') + ' ' + r.name;
  }
}
console.log(`accuracy: ${ok}/${total} (${(100 * ok / total).toFixed(1)}%)`);
console.log('misses:', JSON.stringify(misses));
