// Thaw Drop — p5.js
// One slider at the bottom carries the drama:
//   Frozen (0) → Thaw (1): the solid frozen drop empties out; every particle travels to its place in the
//                          untouched drop — the open ring line or its grey haze.
//   Thaw (1) → Split (2):  tension builds (time slows, the ring trembles, the haze draws in), then the ring
//                          cracks and bursts into ~1,600 marbles that ricochet round the canvas.
//                          Slide back and the ring gathers itself again.
// Easter egg: once thawed, slice quickly across the ring with the cursor to split it open yourself.
// Press H to hide the controls.

new p5((p) => {
  const { gauss, smooth, band, norm360, rnd3, wobble } = Kit;

  const W = 1200, CX = 600, CY = 600, M = 2048, TWO_PI = Math.PI * 2;
  // frozen drop
  const BULGE = 2;         // size of the frozen drop's bulges round the rim, and how much they swell
  const REACH = .5;        // how far the frozen drop's powder disperses
  const RF = 380, BLUR_F = 22, DENS_F = 1.4, INK = 1.6, GROUPS = 8;
  // untouched drop
  const RU = 360, STROKE = 13, BLUR_U = 30, HZ_SD = .78, BREATHE = .35;
  const BASE_U = [182, 275, -7, 108];
  // split
  const SPLIT_AT = 1.6;    // where on the slider the tension snaps
  const MARBLES = 1600, RMAX = 5, GRACE = .12;
  const FUSE = false;      // true lets colliding marbles merge (up to RMAX radius)

  let P, K, rec, thawSl, paused = false, dirty = false, tau = 0, realT = 0;

  // ---- untouched drop's hazy arcs: four edges creeping on their own rhythms ----
  const EU = [...BASE_U], SU = [rnd3(), rnd3(), rnd3(), rnd3()];
  const moveEdges = (t) => {
    EU[0] = BASE_U[0] - P.creep * wobble(t, SU[0]); EU[1] = BASE_U[1] + P.creep * wobble(t, SU[1]);
    EU[2] = BASE_U[2] - P.creep * wobble(t, SU[2]); EU[3] = BASE_U[3] + P.creep * wobble(t, SU[3]);
  };
  const arc = (deg, a, b, r) => { const c = (a + b) / 2; let d = norm360(deg - c); if (d > 180) d -= 360; return band(c + d, a, b, r); };
  const envU = deg => Math.max(arc(deg, EU[0], EU[1], 16), arc(deg, EU[2], EU[3], 20));

  // ---- frozen drop's bulges: random, 2–4 at a time, each its own size, strength and pace (Flux) ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const newBulge = (initial) => ({ c: rand(0, 360), hw: BULGE * rand(14, 70), amp: rand(.55, 1), dir: Math.random() < .8 ? 1 : -1,
    pace: rand(.4, 1.7), life: rand(4, 11), age: initial ? rand(0, 6) : 0, seed: rnd3() });
  let bulges = Array.from({ length: 3 }, () => newBulge(true));
  function updateBulges(dt, t) {
    for (let k = 0; k < bulges.length; k++) {
      const g = bulges[k];
      g.age += dt;
      g.c += g.dir * g.pace * P.flux * dt * (1 + .7 * wobble(t * 1.3, g.seed));   // surges and slackens
      if (g.age > g.life) bulges[k] = newBulge(false);
    }
    if (bulges.length < 2) bulges.push(newBulge(false));
    if (bulges.length < 4 && Math.random() < dt * .08) bulges.push(newBulge(false));
    if (bulges.length > 2 && Math.random() < dt * .05) bulges.splice((Math.random() * bulges.length) | 0, 1);
  }
  function envF(deg) {
    let m = 0;
    for (const g of bulges) {
      const fade = smooth(0, 1.5, g.age) * (1 - smooth(g.life - 1.5, g.life, g.age));   // rise and fall
      const hw = g.hw * (1 + BULGE * P.creep / 60 * wobble(tau * 1.1, g.seed));        // each swells and shrinks
      const v = g.amp * fade * arc(deg, g.c - hw, g.c + hw, Math.min(22, hw * .7));
      if (v > m) m = v;
    }
    return m;
  }

  // ---- particles ----
  // N disc particles + NH frozen-halo particles. Each also carries a destination in the untouched drop:
  // a place on the ring line (role 1) or in the haze (role 2), at its own angle.
  const phases = (x, y) => [.011 * y + .004 * x, .007 * (x + y), .012 * x - .003 * y, .008 * (x - y) + 1.3];
  const MODES_F = [[2, .23], [3, .41], [5, .67], [7, .53]], MPF = MODES_F.map(() => Math.random() * 6.28);
  let N, NH, T, NL, NZ;
  let hx, hy, ux, uy, fr, js, jc, grp, st;          // frozen side
  let hc, hs, hu, hdeg, MS, MC;                     // frozen halo
  let role, a0, dr, du, ds, dn, shx, shy, kr;       // untouched side + split
  function build() {
    const D = P.density;
    N = Math.round(D * DENS_F * Math.PI * RF * RF);
    NH = Math.round(D * DENS_F * TWO_PI * RF * BLUR_F * .7 * 1.5);   // long-tailed halo, extra for the drifting powder
    T = N + NH;
    NL = Math.round(D * 2.4 * TWO_PI * RU * STROKE);                 // particles that become the ring line
    NZ = T - NL;                                                     // the rest become haze (or fade)
    hx = new Float32Array(T); hy = new Float32Array(T); ux = new Float32Array(T); uy = new Float32Array(T); fr = new Float32Array(T);
    js = new Float32Array(T); jc = new Float32Array(T); grp = new Uint8Array(T); st = new Float32Array(T);
    hc = new Float32Array(NH); hs = new Float32Array(NH); hu = new Float32Array(NH); hdeg = new Float32Array(NH);
    MS = MODES_F.map(() => new Float32Array(NH)); MC = MODES_F.map(() => new Float32Array(NH));
    role = new Uint8Array(T); shx = new Float32Array(T); shy = new Float32Array(T); kr = new Float32Array(T);
    a0 = new Float32Array(T); dr = new Float32Array(T); du = new Float32Array(T); ds = new Float32Array(T); dn = new Float32Array(T);

    const common = (i, ang) => {
      const j = Math.random() * 6.283; js[i] = Math.sin(j); jc[i] = Math.cos(j); grp[i] = (Math.random() * GROUPS) | 0;
      a0[i] = ang / TWO_PI;
      du[i] = Math.random() - .5; ds[i] = gauss() * (Math.random() < .12 ? 2.5 : 1); dn[i] = gauss();
      const fa = ang + gauss() * .55, fv = .2 + 1.15 * Math.pow(Math.random(), .6);   // flight when the ring splits
      shx[i] = Math.cos(fa) * fv; shy[i] = Math.sin(fa) * fv; kr[i] = Math.random();
    };
    const lineP = NL / N;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TWO_PI, r = RF * Math.sqrt(Math.random());
      hx[i] = CX + Math.cos(a) * r; hy[i] = CY + Math.sin(a) * r;
      ux[i] = Math.cos(a); uy[i] = Math.sin(a); fr[i] = 1 - Math.pow(r / RF, 6);
      st[i] = .45 * (1 - r / RF);                                    // stagger of the thaw
      common(i, a);
      if (Math.random() < lineP) { role[i] = 1; dr[i] = (Math.random() - .5) * .02; }
      else { role[i] = 2; dr[i] = (Math.random() - .5) * .012; }
    }
    for (let k = 0; k < NH; k++) {
      const a = Math.random() * TWO_PI, i = N + k;
      hc[k] = Math.cos(a); hs[k] = Math.sin(a); hdeg[k] = a * 180 / Math.PI;
      hu[k] = -Math.log(1 - Math.random() * .9999) * .7 + (Math.random() < .05 ? 1.5 + 4 * Math.random() : 0);   // long tail, a few strays
      MODES_F.forEach(([m], j) => { MS[j][k] = Math.sin(m * a + MPF[j]); MC[j][k] = Math.cos(m * a + MPF[j]); });
      ux[i] = hc[k]; uy[i] = hs[k]; fr[i] = .35 * hu[k] / 3;
      st[i] = 0;
      common(i, a);
      role[i] = 2; dr[i] = (Math.random() - .5) * .012;
    }
  }

  // ---- untouched ring table (per frame) ----
  const LX = new Float32Array(M), LY = new Float32Array(M), NXa = new Float32Array(M), NYa = new Float32Array(M);
  const SP = new Float32Array(M), BL = new Float32Array(M), SWU = new Float32Array(M);
  const JM = [[2, -.31, .006], [3, .23, .004], [5, -.17, .002]].map(([k, w, a]) => [k, w, a, Math.random() * 6.28]);
  const SMU = [[2, .23], [3, .41], [4, .29]].map(([k, w]) => [k, w, Math.random() * 6.28]);
  function buildRing(t) {
    const breath = BREATHE * .012 * Math.sin(t * .45), sw = P.swell / 2.2;
    for (let j = 0; j < M; j++) {
      const a = j / M * TWO_PI;
      let r = 1 + breath;
      for (const [k, w, amp, ph] of JM) r += BREATHE * amp * Math.sin(k * a + w * t + ph);
      r *= RU;
      NXa[j] = Math.cos(a); NYa[j] = Math.sin(a);
      LX[j] = CX + r * NXa[j]; LY[j] = CY + r * NYa[j]; SP[j] = r;
      BL[j] = envU(j / M * 360);
      let pulse = 0; for (const [k, w, ph] of SMU) pulse += Math.sin(k * a + w * t + ph);
      SWU[j] = Math.max(.5, 1 + sw * pulse);
    }
  }

  const cg = new Float32Array(GROUPS), sg = new Float32Array(GROUPS), OM = Array.from({ length: GROUPS }, (_, g) => .8 + g * .25);

  // ---- Split / shatter ----
  const SH = { active: false, age: 0, hold: 0, reform: false, src: '', crack: 0, power: 1, cx: 0, cy: 0 };
  const FR = 15, FVX = new Float32Array(FR), FVY = new Float32Array(FR);   // the ring breaks into jagged pieces
  function shatter(src, crack, cx = 0, cy = 0) {
    Object.assign(SH, { active: true, age: 0, hold: 0, reform: false, src, crack, cx, cy });
    for (let f = 0; f < FR; f++) {
      const a = crack + (f + .5) / FR * TWO_PI + gauss() * .18, sp = .45 + .7 * Math.random();
      FVX[f] = Math.cos(a) * sp; FVY[f] = Math.sin(a) * sp;
    }
    spawnMarbles();
  }

  // Marbles: the broken ring becomes a swarm of little spheres that fly, ricochet off the edges
  // and knock into each other.
  let marbles = [];
  function spawnMarbles() {
    marbles = [];
    const rot = P.position * Math.PI / 180, V = 1500 * SH.power, c = Math.cos(rot), s2 = Math.sin(rot);
    for (let n = 0; n < MARBLES; n++) {
      const a = Math.random() * TWO_PI;
      let d = Math.abs(a - SH.crack) % TWO_PI; if (d > Math.PI) d = TWO_PI - d;
      let fa = (a - SH.crack) % TWO_PI; if (fa < 0) fa += TWO_PI;
      const fi = Math.min(FR - 1, (fa / TWO_PI * FR) | 0), g = .6 + .8 * Math.random();
      const rr = RU + (Math.random() - .5) * STROKE, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      const vx = ((FVX[fi] + .45 * SH.cx) * g + gauss() * .18) * V, vy = ((FVY[fi] + .45 * SH.cy) * g + gauss() * .18) * V;
      const r = Math.min(RMAX, P.size * (.9 + .6 * Math.random()));
      marbles.push({ x: CX + x * c - y * s2, y: CY + x * s2 + y * c, vx: vx * c - vy * s2, vy: vx * s2 + vy * c,
                     r, rt: r, t: 0, delay: .12 * d / Math.PI, alpha: 1, gx: 0, gy: 0, gr: 0, gt: 0 });
    }
  }
  function stepMarbles(dt) {
    if (!marbles.length) return;
    const live = [];
    for (const b of marbles) {
      if (SH.age < b.delay) continue;                              // the crack hasn't reached it yet
      b.t += dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const f = Math.exp(-.35 * dt); b.vx *= f; b.vy *= f;          // only a little drag: they keep going haywire
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .9; } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * .9; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * .9; } else if (b.y > W - b.r) { b.y = W - b.r; b.vy = -Math.abs(b.vy) * .9; }
      b.r += (b.rt - b.r) * Math.min(1, dt * 9);
      if (b.gt > 0) b.gt -= dt;
      if (SH.reform) b.alpha = Math.max(0, b.alpha - dt * 2.5);
      if (b.t > GRACE) live.push(b);
    }
    const CELL = 40, grid = new Map(), dead = new Set();            // collisions via a coarse grid
    live.forEach((b, i) => {
      const x0 = Math.floor((b.x - b.r) / CELL), x1 = Math.floor((b.x + b.r) / CELL), y0 = Math.floor((b.y - b.r) / CELL), y1 = Math.floor((b.y + b.r) / CELL);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const k = gy * 1000 + gx; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i);
      }
    });
    for (const cell of grid.values()) for (let a = 0; a < cell.length; a++) for (let q = a + 1; q < cell.length; q++) {
      const A = live[cell[a]], B = live[cell[q]];
      if (dead.has(A) || dead.has(B)) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy, rs = A.r + B.r;
      if (d2 >= rs * rs || d2 === 0) continue;
      const ma = A.rt * A.rt, mb = B.rt * B.rt, nr = Math.sqrt(ma + mb);
      if (FUSE && nr <= RMAX) {                                     // fuse: the bigger absorbs the smaller
        const [Bg, Sm] = ma >= mb ? [A, B] : [B, A], mk = Bg.rt * Bg.rt, ml = Sm.rt * Sm.rt, mt = mk + ml;
        const nx = (Bg.x * mk + Sm.x * ml) / mt, ny = (Bg.y * mk + Sm.y * ml) / mt;
        Bg.vx = (Bg.vx * mk + Sm.vx * ml) / mt; Bg.vy = (Bg.vy * mk + Sm.vy * ml) / mt;
        Bg.gx = Sm.x - nx; Bg.gy = Sm.y - ny; Bg.gr = Sm.r; Bg.gt = .28;
        Bg.x = nx; Bg.y = ny; Bg.rt = nr; Bg.alpha = Math.min(Bg.alpha, Sm.alpha);
        dead.add(Sm);
      } else {                                                      // they ricochet off each other
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = rs - d;
        A.x -= nx * ov * mb / (ma + mb); A.y -= ny * ov * mb / (ma + mb); B.x += nx * ov * ma / (ma + mb); B.y += ny * ov * ma / (ma + mb);
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) { const j = -1.9 * rv / (1 / ma + 1 / mb); A.vx -= j * nx / ma; A.vy -= j * ny / ma; B.vx += j * nx / mb; B.vy += j * ny / mb; }
      }
    }
    if (dead.size) marbles = marbles.filter(b => !dead.has(b));
    if (!SH.active) marbles = [];
  }
  function drawMarbles() {
    for (const b of marbles) {
      if (SH.age < b.delay) continue;
      const appear = smooth(0, .1, b.t) * b.alpha;
      K.ball(b.x, b.y, b.r, appear);
      if (b.gt > 0) { const k = b.gt / .28; K.ball(b.x + b.gx * k, b.y + b.gy * k, b.gr * Math.sqrt(k), appear); }
    }
  }
  function updateShatter(dt) {
    const v = P.thaw;
    if (v >= SPLIT_AT && (!SH.active || SH.src === 'cut')) { if (!SH.active) shatter('slider', Math.random() * TWO_PI); SH.src = 'slider'; SH.reform = false; }
    if (!SH.active) return;
    SH.power = SH.src === 'slider' ? .55 + .9 * smooth(SPLIT_AT, 2, v) : 1;
    SH.hold += dt;
    if (SH.src === 'slider' && v < SPLIT_AT) SH.reform = true;
    if (SH.src === 'cut' && SH.hold > 6) SH.reform = true;          // a cut heals after a while
    if (SH.reform) {
      SH.age -= dt * (SH.src === 'slider' ? 3 : 1.2);
      if (SH.age <= 0) Object.assign(SH, { active: false, age: 0, reform: false });
    } else SH.age = Math.min(2.5, SH.age + dt);
    stepMarbles(dt);
    dirty = true;
  }

  function render() {
    moveEdges(tau);
    const v = P.thaw, m = Math.min(1, v);
    const ten = SH.active ? 0 : smooth(1, SPLIT_AT, v);              // tension before the snap
    const big = smooth(.85, 1, v) * (1 - smooth(1, 1.15, v));       // bigger loose specks, only around Thaw 1
    const mo = P.motion;
    const trem = 4 * ten * ten, tc = Math.cos(realT * 23), ts = Math.sin(realT * 23);
    const shOn = SH.active && SH.age > 0, V = 1500 * SH.power;
    const KN = P.size > 1.2 ? K.kernels(P.size) : null, KB = K.kernels(Math.max(2.5, P.size * 1.7));
    if (m > 0) buildRing(tau);
    for (let g = 0; g < GROUPS; g++) { cg[g] = Math.cos(OM[g] * tau); sg[g] = Math.sin(OM[g] * tau); }
    const R2 = RF * RF;
    const mcF = MODES_F.map(([, w]) => Math.cos(w * tau)), msF = MODES_F.map(([, w]) => Math.sin(w * tau));
    const [M0, M1, M2, M3] = MS, [N0, N1, N2, N3] = MC, swF = P.swell / 2.2;
    const wsL = 1.7 * TWO_PI / NL, whZ = TWO_PI * 2.5066 / NZ, AZ = 2 * mo;
    const rot = P.position * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    K.clear();

    const skipRing = SH.active && !SH.reform && SH.age > .8;         // ring fully gone: only marbles to draw
    for (let i = 0; i < T && !skipRing; i++) {
      const e = m <= 0 ? 0 : m >= 1 ? 1 : smooth(st[i], st[i] + .55, m);
      const g = grp[i], ca = cg[g], sa = sg[g];
      let x0 = 0, y0 = 0, w0 = 0, x1 = 0, y1 = 0, w1 = 0, dotI = false;

      if (e < 1) {                                                  // ---- where it is in the frozen drop
        if (i < N) {                                                // the disc holds perfectly still
          let x = hx[i] - CX, y = hy[i] - CY;
          const r2 = x * x + y * y;
          if (r2 > R2) { const eb = envF(Math.atan2(y, x) * 57.2958), r = Math.sqrt(r2), k = (RF + (r - RF) * (2 * eb - 1)) / r; x *= k; y *= k; }
          x0 = x + CX; y0 = y + CY; w0 = INK;
        } else {
          const k = i - N, b = envF(hdeg[k]);
          if (b >= .03) {
            const pulse = M0[k] * mcF[0] + N0[k] * msF[0] + M1[k] * mcF[1] + N1[k] * msF[1]
                        + .7 * (M2[k] * mcF[2] + N2[k] * msF[2]) + .5 * (M3[k] * mcF[3] + N3[k] * msF[3]);
            const br = b * Math.max(.2, 1 + swF * pulse);
            // powder: each grain lifts off the edge and drifts outward and sideways, thinning as it goes,
            // then a fresh one rises at the rim — so the haze disperses freely, never held to an outline
            const cyc = (tau * .09 + kr[i]) % 1;
            const u = REACH * hu[k] * (1 + 2.2 * cyc * cyc), r = RF + u * BLUR_F * br;
            const side = (js[i] > 0 ? 1 : -1) * cyc * u * BLUR_F * br * .35;
            const swirl = u * BLUR_F * br * .12;                    // a little frosted wander
            x0 = CX + hc[k] * r - hs[k] * side + swirl * (jc[i] * ca - js[i] * sa);
            y0 = CY + hs[k] * r + hc[k] * side + swirl * (js[i] * ca + jc[i] * sa);
            w0 = INK * Math.min(4, 1 / br) * (1 - cyc) ** 1.2 / .55 * REACH;
          } else { x0 = CX + hc[k] * RF; y0 = CY + hs[k] * RF; }
        }
      }

      if (e > 0) {                                                  // ---- where it belongs in the untouched drop
        let a = (a0[i] + dr[i] * mo * tau) % 1; if (a < 0) a += 1;
        const j = (a * M) | 0;
        if (role[i] === 1) {
          const vis = Math.pow(1 - BL[j], 1.3);
          const u = du[i] + .06 * mo * (js[i] * ca + jc[i] * sa) * (Math.abs(du[i]) < .4 ? 1 : 0);
          const loose = P.loose * (1.2 + 22 * Math.pow(BL[j], .7));
          const n = u * STROKE + ds[i] * loose * (Math.abs(du[i]) > .3 ? 1 : .35) * (1 - .8 * ten)
                  + trem * (jc[i] * tc - js[i] * ts);               // the ring trembles as tension builds
          x1 = LX[j] + NXa[j] * n; y1 = LY[j] + NYa[j] * n; w1 = vis * wsL * SP[j] * STROKE;
        } else {
          const b = BL[j];
          const sd = HZ_SD * BLUR_U * SWU[j] * (.25 + .75 * b) * (1 - .55 * ten), n = dn[i] * sd;   // haze draws in under tension
          x1 = LX[j] + NXa[j] * n + AZ * (jc[i] * ca - js[i] * sa); y1 = LY[j] + NYa[j] * n + AZ * (js[i] * ca + jc[i] * sa);
          if (b >= .02) w1 = (P.haze + (1 - P.haze) * (1 - b)) * whZ * SP[j] * sd / (1 + n / RU);
          if (big > 0 && Math.abs(dn[i]) > .9) {                    // loose outer haze: fewer, bigger specks, same tone
            if (kr[i] * (1 + 5 * big) > 1) w1 = 0; else { w1 *= 1 + 5 * big; dotI = true; }
          }
        }
      }

      const ew = e * e * e;                                         // keeps its ink while travelling, settles on arrival
      let w = w0 + (w1 - w0) * ew;
      let x = x0 + (x1 - x0) * e - CX, y = y0 + (y1 - y0) * e - CY;
      if (shOn) {
        // the crack runs round the ring from where it broke; each particle is flung once it reaches it
        let d = Math.abs(a0[i] * TWO_PI - SH.crack) % TWO_PI; if (d > Math.PI) d = TWO_PI - d;
        const ai = SH.age - .12 * d / Math.PI;
        if (ai > 0) {
          const k = (1 - Math.exp(-2.4 * ai)) / 2.4 * V;            // fast release, then drag
          let fa = (a0[i] * TWO_PI - SH.crack + dn[i] * .025) % TWO_PI; if (fa < 0) fa += TWO_PI;   // jagged piece edges
          const fi = Math.min(FR - 1, (fa / TWO_PI * FR) | 0), mix = smooth(.08, 1.1, ai);
          x += (FVX[fi] + (shx[i] - FVX[fi]) * mix + .45 * SH.cx) * k;
          y += (FVY[fi] + (shy[i] - FVY[fi]) * mix + .45 * SH.cy) * k;
          const f = role[i] === 1 ? smooth(.05, .22, ai) : smooth(0, .3, ai);   // fades: the marbles take over
          w -= w * f; if (f > .5) dotI = true;
        }
      }
      if (w <= 0) continue;
      const X = CX + x * cr - y * sr, Y = CY + x * sr + y * cr;
      if (dotI) K.splatK(X, Y, w, KB);
      else if (KN && w > .12) K.splatK(X, Y, w, KN);                // faint haze grains stay as plain points
      else K.splat(X, Y, w);
    }

    if (SH.active) drawMarbles();
    K.flush(p);
    rec.copy();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(W, W);
    K = Kit.raster(W);
    const onInput = () => { dirty = true; };
    ({ P } = Kit.panel(p, [
      { id: 'density', label: 'Density', min: .4, max: 2.5, step: .05, value: 1 },
      { id: 'size', label: 'Size', min: 1, max: 5, step: .5, value: 2 },
      { id: 'flux', label: 'Flux', min: 0, max: 180, step: 1, value: 60 },
      { id: 'creep', label: 'Creep', min: 0, max: 80, step: 1, value: 30 },
      { id: 'swell', label: 'Swell', min: 0, max: .9, step: .01, value: .35 },
      { id: 'haze', label: 'Haze', min: .1, max: .9, step: .01, value: .26 },
      { id: 'loose', label: 'Loose', min: 0, max: 1, step: .01, value: .5 },
      { id: 'motion', label: 'Motion', min: 0, max: 3, step: .05, value: 1 },
      { id: 'speed', label: 'Speed', min: 0, max: 3, step: .05, value: .6 },
      { id: 'position', label: 'Position', min: 0, max: 360, step: 1, value: 0 },
    ], 'panel top-left', onInput, (id) => { if (id === 'density') { build(); dirty = true; } }));
    // the Thaw slider sits on its own at the bottom
    let thaw = null;
    thaw = Kit.panel(p, [{ id: 'thaw', label: 'Thaw', min: 0, max: 2, step: .001, value: 0 }], 'long',
                     () => { P.thaw = thaw.P.thaw; dirty = true; });
    P.thaw = thaw.P.thaw; thawSl = thaw.P._thaw;
    p.createSpan('').parent(thaw.el);
    p.createDiv('<span>Frozen</span><span>Thaw</span><span>Split</span>').addClass('ticks').parent(thaw.el);
    const [, , bg] = Kit.buttons(p, [
      { label: 'Pause', click: (b) => { paused = !paused; b.html(paused ? 'Play' : 'Pause'); } },
      { label: 'Save PNG', click: () => Kit.savePNG(p.canvas, 'thaw-drop') },
      { select: [['White bg', '#fff'], ['Transparent (Chrome)', '']] },
      { label: 'Record', click: (b) => rec.toggle(b) },
    ], 'ui top-right');
    rec = Kit.recorder(p.canvas, 'thaw-drop', bg);
    Kit.hideOnH(); Kit.fit(p);
    build();

    // Easter egg: slice quickly across the ring with the cursor
    let lastPt = null;
    addEventListener('pointermove', (e) => {
      if (e.target.closest && e.target.closest('.panel,.ui,.long')) { lastPt = null; return; }
      const rc2 = p.canvas.getBoundingClientRect(), k = W / rc2.width;
      const pt = { x: (e.clientX - rc2.left) * k, y: (e.clientY - rc2.top) * k, t: performance.now() };
      if (lastPt && P.thaw >= .98 && P.thaw < SPLIT_AT && !SH.active) {
        const r0 = Math.hypot(lastPt.x - CX, lastPt.y - CY), r1 = Math.hypot(pt.x - CX, pt.y - CY);
        const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y), speed = dist / Math.max(1, pt.t - lastPt.t);
        if ((r0 - RU) * (r1 - RU) < 0 && speed > 1.2) {             // crossed the ring, fast: a cut
          const f = (r0 - RU) / (r0 - r1), cx = lastPt.x + (pt.x - lastPt.x) * f - CX, cy = lastPt.y + (pt.y - lastPt.y) * f - CY;
          const rot = P.position * Math.PI / 180, ux2 = (pt.x - lastPt.x) / dist, uy2 = (pt.y - lastPt.y) / dist;
          // undo the Position rotation so the crack and the cut direction sit in the ring's own frame
          shatter('cut', Math.atan2(cy, cx) - rot, ux2 * Math.cos(rot) + uy2 * Math.sin(rot), -ux2 * Math.sin(rot) + uy2 * Math.cos(rot));
        }
      }
      lastPt = pt;
    });
  };
  p.windowResized = () => Kit.fit(p);
  p.draw = () => {
    const dt = Math.min(.05, p.deltaTime / 1000);
    if (!paused) {
      realT += dt; updateShatter(dt);
      tau += dt * P.speed * (SH.active ? 1 : 1 - .85 * smooth(1, SPLIT_AT, P.thaw));   // time slows under tension
      updateBulges(dt * P.speed, tau);
    }
    if (!paused || dirty) { render(); dirty = false; }
  };

  // handy for testing from the console
  window.thawDrop = { get SH() { return SH; }, get marbles() { return marbles; }, render: () => render(), step: (dt) => updateShatter(dt),
                      setThaw: (v) => { thawSl.value(v); thawSl.elt.dispatchEvent(new Event('input')); } };
});
