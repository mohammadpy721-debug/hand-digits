// $1 Unistroke Recognizer (Wobbrock et al.), adapted. Pure JS, no training.
const ONE = (() => {
  const N = 64, SIZE = 250, HALF_DIAG = 0.5 * Math.sqrt(SIZE * SIZE + SIZE * SIZE);
  const ANGLE_RANGE = 45 * Math.PI / 180, ANGLE_PREC = 2 * Math.PI / 180, PHI = 0.5 * (-1 + Math.sqrt(5));

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]); return d; }

  function resample(pts, n) {
    const I = pathLength(pts) / (n - 1);
    let D = 0; const out = [pts[0]]; const src = pts.map(p => ({ x: p.x, y: p.y }));
    for (let i = 1; i < src.length; i++) {
      const d = dist(src[i - 1], src[i]);
      if (D + d >= I) {
        const t = (I - D) / d;
        const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
        out.push(q); src.splice(i, 0, q); D = 0;
      } else D += d;
    }
    while (out.length < n) out.push(src[src.length - 1]);
    return out.slice(0, n);
  }

  function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; } return { x: x / pts.length, y: y / pts.length }; }

  function rotateBy(pts, a) {
    const c = centroid(pts), cs = Math.cos(a), sn = Math.sin(a);
    return pts.map(p => ({ x: (p.x - c.x) * cs - (p.y - c.y) * sn + c.x, y: (p.x - c.x) * sn + (p.y - c.y) * cs + c.y }));
  }

  function scaleTo(pts, size) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const w = maxX - minX || 1, h = maxY - minY || 1;
    return pts.map(p => ({ x: p.x * size / w, y: p.y * size / h }));
  }

  function translateTo(pts, k) { const c = centroid(pts); return pts.map(p => ({ x: p.x - c.x + k.x, y: p.y - c.y + k.y })); }

  function pathDistance(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += dist(a[i], b[i]); return d / a.length; }

  function normalize(raw) {
    let pts = resample(raw, N);
    const c = centroid(pts);
    const indicative = Math.atan2(pts[0].y - c.y, pts[0].x - c.x);
    pts = rotateBy(pts, -indicative);
    pts = scaleTo(pts, SIZE);
    return translateTo(pts, { x: 0, y: 0 });
  }

  function recognize(raw, templates) {
    if (!raw || raw.length < 8) return { name: null, score: 0 };
    const pts = normalize(raw);
    let best = Infinity, name = null;
    for (const t of templates) {
      // golden-section search over rotation
      let a = -ANGLE_RANGE, b = ANGLE_RANGE;
      let x1 = PHI * a + (1 - PHI) * b, x2 = (1 - PHI) * a + PHI * b;
      let f1 = pathDistance(rotateBy(pts, x1), t.points), f2 = pathDistance(rotateBy(pts, x2), t.points);
      while (Math.abs(b - a) > ANGLE_PREC) {
        if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = pathDistance(rotateBy(pts, x1), t.points); }
        else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = pathDistance(rotateBy(pts, x2), t.points); }
      }
      const d = Math.min(f1, f2);
      if (d < best) { best = d; name = t.name; }
    }
    const score = Math.max(0, 1 - best / HALF_DIAG);
    return { name, score };
  }

  function makeTemplate(name, raw) { return { name, points: normalize(raw) }; }
  return { recognize, makeTemplate, normalize };
})();
if (typeof module !== 'undefined') module.exports = ONE;
