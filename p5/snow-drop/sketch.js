// Snow Drop (crystallizing drop) — p5.js
// Snowflake arms grow outward from the ring, and crystals grow inward toward an irregular hollow,
// spreading from the top of the drop to the bottom. Tilt-blur controls at the top left.
// Press H to hide the controls.

new p5((p) => Growth(p, {
  name: 'snow-drop',
  build({ gauss, env, R, CX, CY, OFF }) {
    const ARMS = 84;         // main snowflake arms growing outward
    const ARMS_IN = 180;     // crystals growing inward from the ring
    const GROW = 14;         // arm growth speed (units/sec) — lower = slower
    const SPREAD = 14;       // seconds for frost to travel from top to bottom
    const CORE = .34;        // irregular hollow at the centre that inward crystals stop short of
    const waves = [2, 3, 5, 7, 11].map(f => ({ f, p: Math.random() * 6.28, amp: .1 / Math.sqrt(f) }));
    const coreR = a => R * CORE * (1 + waves.reduce((s, w) => s + w.amp * Math.sin(w.f * a + w.p), 0));
    const pts = [];

    // a branching snowflake arm: side branches split off at 60°
    function grow(x, y, dir, len, birth, depth, maxD = 2) {
      const cs = Math.cos(dir), sn = Math.sin(dir), nx = -sn, ny = cs;
      const gap = len * (.16 + Math.random() * .08);
      let next = gap * (.6 + Math.random() * .4);
      for (let d = 0; d < len; d += 1) {
        const f = 1 - d / len, w = (depth ? .8 : 1.6) * f + .3;
        const bx = x + cs * d, by = y + sn * d, b = birth + d / GROW;
        for (let j = 0, n = depth ? 2 : 3; j < n; j++) {
          const o = gauss() * w;
          pts.push({ x: bx + nx * o + gauss() * .3, y: by + ny * o + gauss() * .3, b, a: .5 + .4 * f });
        }
        if (depth < maxD && d >= next && d < len * .85) {
          const bl = (len - d) * (.35 + Math.random() * .2);
          grow(bx, by, dir + Math.PI / 3, bl, b, depth + 1, maxD);
          grow(bx, by, dir - Math.PI / 3, bl * (.85 + Math.random() * .3), b, depth + 1, maxD);
          next += gap;
        }
      }
    }

    for (let i = 0; i < ARMS; i++) {                      // outward arms
      const a = (i + Math.random() * .6) / ARMS * Math.PI * 2, e = env(a);
      const x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R + e * OFF;
      const fromTop = Math.acos(-Math.sin(a)) / Math.PI;
      grow(x, y, a, 30 + Math.random() * 55 + Math.abs(e) * 25, 1 + fromTop * SPREAD + Math.random() * 1.5, 0);
    }
    for (let i = 0; i < ARMS_IN; i++) {                   // inward crystals
      const a = (i + Math.random()) / ARMS_IN * Math.PI * 2;
      const fromTop = Math.acos(-Math.sin(a)) / Math.PI;
      grow(CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2), a + Math.PI, (R - coreR(a)) * (.55 + Math.random() * .45),
           2 + fromTop * SPREAD + Math.random() * 3, 0, Math.random() < .3 ? 2 : 1);
    }
    // keep inward growth inside the ring and outside the hollow
    return pts.filter(q => {
      const dx = q.x - CX, dy = q.y - CY, r = Math.hypot(dx, dy);
      return r > R - 2 || r >= coreR(Math.atan2(dy, dx));
    });
  },
}));
