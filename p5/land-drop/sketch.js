// Land Drop — p5.js
// The drop reaching land, seen from above: it flattens into a sheet, throws up a splash crown that pinches
// off into satellite droplets, sprays, soaks into a stain (grains gathering at the rim), and releases
// petrichor specks. Tilt-blur controls at the top left. Press H to hide the controls.

new p5((p) => Growth(p, {
  name: 'land-drop',
  build({ gauss, R, CX, CY }) {
    const SPREAD_R = 1.3;    // how far the flattened drop spreads (× R)
    const SPLASH_R = 1.7;    // how far satellite droplets fly (× R)
    const FINGERS = 30;      // splash fingers around the rim
    const SPRAY = 9000;      // fine spray particles
    const AEROSOL = 2500;    // petrichor specks
    const SOAK = 120000;     // stain particles as the water seeps into the ground
    const fingers = Array.from({ length: FINGERS }, (_, i) => (i + .5 + gauss() * .2) / FINGERS * Math.PI * 2);
    const rimWaves = [3, 5, 8].map(f => ({ f, p: Math.random() * 6.28 }));
    const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
    const rimR = a => {
      let r = R * SPREAD_R * (1 + rimWaves.reduce((s, w) => s + .012 * Math.sin(w.f * a + w.p), 0));
      for (const f of fingers) { const d = angDiff(a, f) / .035; r += 12 * Math.exp(-d * d); }
      return r;
    };
    const pts = [], push = (x, y, b, a) => pts.push({ x, y, b, a });
    const polar = (a, r, b, al) => push(CX + Math.cos(a) * r, CY + Math.sin(a) * r, b, al);
    const blob = (x, y, rad, b, al) => { for (let n = 0, N = rad * rad * 9; n < N; n++) {
      const t = Math.random() * 6.283, q = rad * Math.sqrt(Math.random()); push(x + Math.cos(t) * q, y + Math.sin(t) * q, b, al); } };

    // 1. impact: the drop flattens into a thin sheet spreading past the old edge
    for (let i = 0; i < 90000; i++) {
      const a = Math.random() * 6.283, f = Math.pow(Math.random(), .8), rr = rimR(a);
      polar(a, R + (rr - R) * f, 1 + f * 1.6, .06 + .12 * f);
    }
    for (let i = 0; i < 30000; i++) { const a = Math.random() * 6.283; polar(a, rimR(a) + gauss() * 1.2, 2.6 + Math.random() * .2, .55); }
    // 2. splash crown: fingers shoot out and pinch off into satellite droplets
    for (const f of fingers) {
      const r0 = rimR(f), L = 15 + Math.random() * 35, Wd = 2 + Math.random() * 3;
      for (let n = 0, N = L * Wd * 6; n < N; n++) {
        const d = L * Math.random(), o = (Math.random() * 2 - 1) * Wd * (1 - d / L * .7);
        polar(f + o / (r0 + d), r0 + d, 2.6 + d / 30, .6);
      }
      let dist = r0 + L;
      for (let k = 0, K = 1 + (Math.random() * 3 | 0); k < K && dist < R * SPLASH_R; k++) {
        dist += 8 + Math.random() * (R * SPLASH_R - dist) * .5;
        const rad = 2 + Math.random() * 3.5 * (1 - k * .25), a = f + gauss() * .01;
        blob(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist, rad, 3 + (dist - r0) / 40, .65);
      }
    }
    // 3. fine spray between the fingers
    for (let i = 0; i < SPRAY; i++) {
      const a = Math.random() * 6.283, rr = rimR(a), r = rr + (R * SPLASH_R * 1.05 - rr) * Math.pow(Math.random(), 1.5);
      polar(a, r, 2.8 + (r - rr) / 40, .3);
    }
    // 4. soak-in stain: water seeps away, grains gather at the rim (coffee-ring), the inside mottles
    const clumps = Array.from({ length: 400 }, () => { const a = Math.random() * 6.283; return { a, r: rimR(a) * Math.sqrt(Math.random()) }; });
    for (let i = 0; i < SOAK; i++) {
      if (Math.random() < .45) { const a = Math.random() * 6.283; polar(a, rimR(a) * (1 - Math.abs(gauss()) * .025), 6 + Math.random() * 10, .1); }
      else { const c = clumps[(Math.random() * clumps.length) | 0];
        push(CX + Math.cos(c.a) * c.r + gauss() * 6, CY + Math.sin(c.a) * c.r + gauss() * 6, 8 + Math.random() * 12, .07); }
    }
    // 5. petrichor: tiny aerosol specks released from the soil, scattered wide
    for (let i = 0; i < AEROSOL; i++) { const a = Math.random() * 6.283, r = R * 1.8 * Math.sqrt(Math.random()); polar(a, r, 6 + Math.random() * 14, .35); }
    return pts;
  },
}));
