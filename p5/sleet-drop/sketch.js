// Sleet Drop — p5.js
// A melted drop refreezing from the outside in: an ice shell thickens inward, the liquid core shrinks,
// spikes and bulges push out as it expands, and hairline cracks run across the shell.
// Tilt-blur controls at the top left. Press H to hide the controls.

new p5((p) => Growth(p, {
  name: 'sleet-drop',
  build({ gauss, R, CX, CY }) {
    const CORE_END = .3;     // size of the liquid core left at the end (fraction of R)
    const FREEZE = 20;       // seconds for the freezing front to travel inward
    const SHELL = 170000;    // particles in the ice shell
    const SPIKES = 28;       // spikes and bulges pushed out by expansion
    const CRACKS = 14;       // hairline cracks across the shell
    const waves = [2, 3, 5, 7, 11].map(f => ({ f, p: Math.random() * 6.28, amp: .1 / Math.sqrt(f) }));
    const coreR = a => R * CORE_END * (1 + waves.reduce((s, w) => s + w.amp * Math.sin(w.f * a + w.p), 0));
    const fromTop = a => Math.acos(-Math.sin(a)) / Math.PI;
    const pts = [], push = (x, y, b, a) => pts.push({ x, y, b, a });

    // ice shell: dense at the edge, columnar radial texture, the freezing front moves inward
    const columns = Array.from({ length: 260 }, () => Math.random() * Math.PI * 2);
    for (let i = 0; i < SHELL; i++) {
      const a = Math.random() < .4 ? columns[(Math.random() * columns.length) | 0] + gauss() * .004 : Math.random() * Math.PI * 2;
      const c = coreR(a), f = Math.pow(Math.random(), 1.25), r = R - (R - c) * f;
      push(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 1 + fromTop(a) * 3 + f * FREEZE * (1 + gauss() * .04), .07 + .22 * (1 - .7 * f));
    }
    // spikes and bulges from freezing expansion
    for (let i = 0; i < SPIKES; i++) {
      const a = Math.random() * Math.PI * 2, bulge = Math.random() < .35;
      const L = bulge ? 6 + Math.random() * 10 : 14 + Math.random() * 34;
      const Wd = bulge ? L * (1 + Math.random() * .4) : 3 + Math.random() * 6;
      const start = 1 + fromTop(a) * 3 + FREEZE * (.35 + Math.random() * .5);
      const cs = Math.cos(a), sn = Math.sin(a), bx = CX + cs * R, by = CY + sn * R;
      for (let n = 0, N = L * Wd * 7; n < N; n++) {
        const d = L * Math.random();
        const hw = Wd * (bulge ? Math.sqrt(Math.max(0, 1 - (d / L) ** 2)) : Math.pow(1 - d / L, .6));
        const o = (Math.random() * 2 - 1) * hw;
        push(bx + cs * d - sn * o, by + sn * d + cs * o, start + d / 6, .45 + .3 * (1 - d / L));
      }
    }
    // hairline cracks wandering inward across the shell
    for (let i = 0; i < CRACKS; i++) {
      const a = Math.random() * Math.PI * 2;
      let x = CX + Math.cos(a) * (R - 2), y = CY + Math.sin(a) * (R - 2), dir = a + Math.PI + gauss() * .5;
      const len = 40 + Math.random() * 110, start = 1 + FREEZE * (.6 + Math.random() * .4);
      for (let d = 0; d < len; d += .6) {
        dir += gauss() * .07; x += Math.cos(dir) * .6; y += Math.sin(dir) * .6;
        const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy);
        if (r < coreR(Math.atan2(dy, dx)) || r > R - 1) break;
        push(x + gauss() * .25, y + gauss() * .25, start + d / 25, .75);
      }
    }
    return pts;
  },
}));
