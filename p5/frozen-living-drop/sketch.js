// Frozen Living Drop — p5.js
// A solid drop made of ~650,000 particles. Its crisp edges stay crisp; its soft edges creep and swell.
// Press H to hide the controls.

new p5((p) => {
  const { gauss, smooth, band, wobble } = Kit;

  // ---- Form (canvas pixels) ----
  const W = 1200, CX = 600, CY = 600;
  const R = 380;           // drop radius
  const GROUPS = 8;        // jitter frequency groups
  const INK = 1.6;         // darkness per particle — higher = more solid black, lower = more grain

  // Where the edge is blurred (screen angles in degrees, 0 = right, 90 = bottom).
  // Each of the four meeting points between crisp and blurred drifts on its own irregular rhythm.
  const BASE = [100, 268, -45, 42], EDGE = [...BASE];
  const blurEnv = (deg) => {
    const d = ((deg % 360) + 360) % 360, d2 = d > 180 ? d - 360 : d;
    return Math.max(band(d, EDGE[0], EDGE[1], 22), .9 * band(d2, EDGE[2], EDGE[3], 25));
  };
  const SEEDS = Array.from({ length: 4 }, () => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28]);
  const moveEdges = (t) => {
    EDGE[0] = BASE[0] - P.creep * wobble(t, SEEDS[0]); EDGE[1] = BASE[1] + P.creep * wobble(t, SEEDS[1]);
    EDGE[2] = BASE[2] - P.creep * wobble(t, SEEDS[2]); EDGE[3] = BASE[3] + P.creep * wobble(t, SEEDS[3]);
  };
  // outward swell: uneven pulses round the rim
  const MODES = [[2, .23], [3, .41], [5, .67], [7, .53]], MP = MODES.map(() => Math.random() * 6.28);

  let P, K, rec, paused = false, dirty = false, tau = 0;
  const phases = (x, y) => [.011 * y + .004 * x, .007 * (x + y), .012 * x - .003 * y, .008 * (x - y) + 1.3];

  let N, NH, hx, hy, ux, uy, fr, S, C, js, jc, grp, hc, hs, hu, hdeg, MS, MC;
  function build() {
    N = Math.round(P.density * Math.PI * R * R);
    NH = Math.round(P.density * 2 * Math.PI * R * P.blur / Math.sqrt(2 / Math.PI));
    const T = N + NH;
    hx = new Float32Array(T); hy = new Float32Array(T);
    ux = new Float32Array(T); uy = new Float32Array(T); fr = new Float32Array(T);
    S = Array.from({ length: 4 }, () => new Float32Array(T)); C = Array.from({ length: 4 }, () => new Float32Array(T));
    js = new Float32Array(T); jc = new Float32Array(T); grp = new Uint8Array(T);
    hc = new Float32Array(NH); hs = new Float32Array(NH); hu = new Float32Array(NH); hdeg = new Float32Array(NH);
    MS = MODES.map(() => new Float32Array(NH)); MC = MODES.map(() => new Float32Array(NH));
    const setCommon = (i, x, y) => {
      const ph = phases(x, y);
      for (let k = 0; k < 4; k++) { S[k][i] = Math.sin(ph[k]); C[k][i] = Math.cos(ph[k]); }
      const j = Math.random() * 6.283; js[i] = Math.sin(j); jc[i] = Math.cos(j); grp[i] = (Math.random() * GROUPS) | 0;
    };
    for (let i = 0; i < N; i++) {             // interior: uniform in the disc
      const a = Math.random() * 6.283, r = R * Math.sqrt(Math.random());
      hx[i] = CX + Math.cos(a) * r; hy[i] = CY + Math.sin(a) * r;
      ux[i] = Math.cos(a); uy[i] = Math.sin(a); fr[i] = 1 - Math.pow(r / R, 6);   // radial motion fades to 0 at the rim
      setCommon(i, hx[i], hy[i]);
    }
    for (let k = 0; k < NH; k++) {            // halo: outward half-gaussian beyond the rim
      const a = Math.random() * 6.283, i = N + k;
      hc[k] = Math.cos(a); hs[k] = Math.sin(a); hdeg[k] = a * 180 / Math.PI; hu[k] = Math.min(3, Math.abs(gauss()));
      MODES.forEach(([m], j) => { MS[j][k] = Math.sin(m * a + MP[j]); MC[j][k] = Math.cos(m * a + MP[j]); });
      ux[i] = hc[k]; uy[i] = hs[k]; fr[i] = .35 * hu[k] / 3;
      hx[i] = CX + hc[k] * (R + hu[k] * P.blur); hy[i] = CY + hs[k] * (R + hu[k] * P.blur);
      setCommon(i, hx[i], hy[i]);
    }
  }

  const cg = new Float32Array(GROUPS), sg = new Float32Array(GROUPS), OM = Array.from({ length: GROUPS }, (_, g) => .8 + g * .25);

  function render() {
    const phiDeg = P.position, phi = phiDeg * Math.PI / 180;
    moveEdges(tau);
    const A = P.motion * .5, J = Math.min(1.5, P.motion * .25);
    const a1 = .7 * tau, a2 = -.45 * tau, a3 = -.6 * tau, a4 = .5 * tau;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const c3 = Math.cos(a3), s3 = Math.sin(a3), c4 = Math.cos(a4), s4 = Math.sin(a4);
    for (let g = 0; g < GROUPS; g++) { cg[g] = Math.cos(OM[g] * tau); sg[g] = Math.sin(OM[g] * tau); }
    const [S0, S1, S2, S3] = S, [C0, C1, C2, C3] = C, R2 = R * R;
    K.clear();

    for (let i = 0; i < N; i++) {
      const g = grp[i], ca = cg[g], sa = sg[g];
      let dx = A * (S0[i] * c1 + C0[i] * s1 + S1[i] * c2 + C1[i] * s2) + J * (jc[i] * ca - js[i] * sa);
      let dy = A * (S2[i] * c3 + C2[i] * s3 + S3[i] * c4 + C3[i] * s4) + J * (js[i] * ca + jc[i] * sa);
      const q = (dx * ux[i] + dy * uy[i]) * (1 - fr[i]); dx -= ux[i] * q; dy -= uy[i] * q;
      let x = hx[i] - CX + dx, y = hy[i] - CY + dy;
      const r2 = x * x + y * y;
      if (r2 > R2) {
        // crisp edge: reflect back inside. Blurred edge: let it spill out with the halo.
        const e = blurEnv(Math.atan2(y, x) * 57.2958 - phiDeg);
        const r = Math.sqrt(r2), k = (R + (r - R) * (2 * e - 1)) / r; x *= k; y *= k;
      }
      K.splat(x + CX, y + CY, INK);
    }

    const cp = Math.cos(phi), sp = Math.sin(phi);
    const mc = MODES.map(([, w]) => Math.cos(w * tau)), ms = MODES.map(([, w]) => Math.sin(w * tau));
    const [M0, M1, M2, M3] = MS, [N0, N1, N2, N3] = MC, sw = P.swell / 2.2;
    for (let k = 0; k < NH; k++) {
      const i = N + k, b = blurEnv(hdeg[k]);
      if (b < .03) continue;
      const pulse = M0[k] * mc[0] + N0[k] * ms[0] + M1[k] * mc[1] + N1[k] * ms[1]
                  + .7 * (M2[k] * mc[2] + N2[k] * ms[2]) + .5 * (M3[k] * mc[3] + N3[k] * ms[3]);
      const br = b * Math.max(.2, 1 + sw * pulse), r = R + hu[k] * P.blur * br;
      const g = grp[i], ca = cg[g], sa = sg[g];
      let dx = A * (S0[i] * c1 + C0[i] * s1 + S1[i] * c2 + C1[i] * s2) + J * (jc[i] * ca - js[i] * sa);
      let dy = A * (S2[i] * c3 + C2[i] * s3 + S3[i] * c4 + C3[i] * s4) + J * (js[i] * ca + jc[i] * sa);
      const vx = hc[k] * cp - hs[k] * sp, vy = hs[k] * cp + hc[k] * sp;   // rotated by Position
      const q = (dx * vx + dy * vy) * (1 - fr[i]); dx -= vx * q; dy -= vy * q;
      K.splat(CX + vx * r + dx, CY + vy * r + dy, INK * Math.min(4, 1 / br));
    }
    K.flush(p);
    rec.copy();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(W, W);
    K = Kit.raster(W);
    ({ P } = Kit.panel(p, [
      { id: 'density', label: 'Density', min: .4, max: 3, step: .1, value: 1.4 },
      { id: 'blur', label: 'Blur', min: 2, max: 50, step: 1, value: 22 },
      { id: 'motion', label: 'Motion', min: 0, max: 30, step: .5, value: 6 },
      { id: 'speed', label: 'Speed', min: 0, max: 3, step: .05, value: .6 },
      { id: 'creep', label: 'Creep', min: 0, max: 80, step: 1, value: 30 },
      { id: 'swell', label: 'Swell', min: 0, max: .9, step: .01, value: .4 },
      { id: 'position', label: 'Position', min: 0, max: 360, step: 1, value: 0 },
    ], 'panel bottom-left', () => { dirty = true; }, (id) => { if (id === 'density' || id === 'blur') { build(); dirty = true; } }));
    const [, , bg] = Kit.buttons(p, [
      { label: 'Pause', click: (b) => { paused = !paused; b.html(paused ? 'Play' : 'Pause'); } },
      { label: 'Save PNG', click: () => Kit.savePNG(p.canvas, 'frozen-living-drop') },
      { select: [['White bg', '#fff'], ['Transparent (Chrome)', '']] },
      { label: 'Record', click: (b) => rec.toggle(b) },
    ], 'ui bottom-right');
    rec = Kit.recorder(p.canvas, 'frozen-living-drop', bg);
    Kit.hideOnH(); Kit.fit(p);
    build();
  };
  p.windowResized = () => Kit.fit(p);
  p.draw = () => {
    const dt = Math.min(.05, p.deltaTime / 1000);
    if (!paused) tau += dt * P.speed;
    if (!paused || dirty) { render(); dirty = false; }
  };
});
