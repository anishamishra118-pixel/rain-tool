// Pressure Drop — p5.js
// "Raindrop under pressure and resistance": a soft, jellyfish-like ring of particles. A slow pressure cycle
// drives one wall in until the drop is stretched into a distorted U, holds it trembling, then eases it back.
// Its hazy arcs travel round the ring but never enter the stretched U.
// Press H to hide the controls.

new p5((p) => {
  const { gauss, smooth, band, norm360, rnd3, wobble } = Kit;

  // ---- Form (canvas pixels; angles are screen degrees, 0 = right, 90 = bottom) ----
  const W = 1200, CX = 600, CY = 610;
  const R = 340;            // base radius
  const DENT = [112, 52];   // centre and half-width (degrees) of the soft pressed-in wall, lower left
  const DEPTH = .27;        // resting depth of the dent (fraction of R)
  const PUSH = 1.3;         // how far (× R) the dent is driven in at full pressure — it nearly reaches the far wall
  const STROKE = 11;        // resting line thickness
  const DENSITY = 1;        // particle density multiplier
  const M = 2048;           // samples round the outline per frame
  const TWO_PI = Math.PI * 2, rad = d => d * Math.PI / 180;

  // Where the line dissolves into haze: a left arc and a right arc. They travel round the ring (Travel),
  // and their four edges creep on their own irregular rhythms (Creep).
  const BASE = [160, 230, -32, 57], EDGE = [...BASE];
  const arc = (deg, a, b, r) => { const c = (a + b) / 2; let d = norm360(deg - c); if (d > 180) d -= 360; return band(c + d, a, b, r); };
  const blurEnv = (deg) => Math.max(arc(deg, EDGE[0], EDGE[1], 16), arc(deg, EDGE[2], EDGE[3], 20));
  const ESEED = [rnd3(), rnd3(), rnd3(), rnd3()];
  let travelL = 0, travelR = 0;
  const moveEdges = (t) => {
    const oL = travelL + 25 * wobble(t * .5, ESEED[0]), oR = travelR + 25 * wobble(t * .5, ESEED[2]);
    EDGE[0] = BASE[0] + oL - P.creep * wobble(t, ESEED[0]); EDGE[1] = BASE[1] + oL + P.creep * wobble(t, ESEED[1]);
    EDGE[2] = BASE[2] + oR - P.creep * wobble(t, ESEED[2]); EDGE[3] = BASE[3] + oR + P.creep * wobble(t, ESEED[3]);
  };
  // soft dent profile (cos² window, no corners)
  const dentShape = (deg) => {
    let d = norm360(deg) - DENT[0]; if (d > 180) d -= 360; if (d < -180) d += 360;
    return Math.abs(d) >= DENT[1] ? 0 : Math.cos(Math.PI / 2 * d / DENT[1]) ** 2;
  };
  // shoulders: either side of the pressed wall, where resistance gathers
  const shoulder = (deg) => { let d = norm360(deg) - DENT[0]; if (d > 180) d -= 360; const a = (Math.abs(d) - DENT[1] * .75) / 14; return Math.exp(-a * a); };

  let P, K, rec, paused = false, dirty = false, tau = 0;

  // ---- Per-frame outline table ----
  const LX = new Float32Array(M), LY = new Float32Array(M), NX = new Float32Array(M), NY = new Float32Array(M);
  const TH = new Float32Array(M), SP = new Float32Array(M), BL = new Float32Array(M), RR = new Float32Array(M);
  const HX = new Float32Array(M), HY = new Float32Array(M), KP = new Float32Array(M);   // smoothed normals for the haze
  const DS = new Float32Array(M), SH = new Float32Array(M), BU = new Float32Array(M), SW = new Float32Array(M), LB = new Float32Array(M), MK = new Float32Array(M);
  // jellyfish body: slow travelling ripples + haze swell modes
  const JM = [[2, -.5, .05], [3, .37, .035], [4, -.8, .02], [5, .61, .012]].map(([k, w, a]) => [k, w, a, Math.random() * 6.28]);
  const SM = [[2, .23], [3, .41], [5, .67], [7, .53]].map(([k, w]) => [k, w, Math.random() * 6.28]);
  for (let j = 0; j < M; j++) {                      // static profiles
    const deg = j / M * 360;
    DS[j] = dentShape(deg); SH[j] = shoulder(deg);
    const win = (c, h) => { let d = norm360(deg - c); if (d > 180) d -= 360; return Math.abs(d) >= h ? 0 : Math.cos(Math.PI / 2 * d / h) ** 2; };
    let d = Math.abs(norm360(deg - DENT[0])); if (d > 180) d = 360 - d;
    // how much each point is carried in by the push: a broad, flat-bottomed band with a soft extra dip,
    // so the dent deepens into a rounded U rather than a point
    BU[j] = .8 * (1 - smooth(16, 100, d)) + .2 * win(DENT[0], 45);
    LB[j] = Math.max(win(22, 62), win(202, 62));     // the two arms of the U bulge out as it stretches
    MK[j] = 1 - win(DENT[0], 88);                    // haze never enters the stretched U
  }

  // Pressure cycle: a slow stretch to the brink, a trembling hold, then a smooth release.
  // It never fully lets go, so the bean always keeps a little of its pinch. Each cycle differs a little.
  const CYCLE = 8, FLOOR = .22;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const press = (t) => {
    const c = Math.floor(t / CYCLE), u = t - c * CYCLE;
    const peak = .8 + .2 * hash(c), load = CYCLE * (.42 + .14 * hash(c + 9)), hold = .5 + .4 * hash(c + 3);
    if (u < load) return FLOOR + (peak - FLOOR) * smooth(0, load, u);
    if (u < load + hold) return peak;
    return peak - (peak - FLOOR) * smooth(load + hold, CYCLE, u);
  };

  function buildOutline(t) {
    moveEdges(t);
    const pr = press(t) * P.pressure, pp = Math.max(0, pr);
    const tremor = P.resist * pp * pp * .025 * (Math.sin(t * 11.3) + .6 * Math.sin(t * 17.9 + 1));   // it trembles as it resists
    // the push comes from one side only: the wall is carried straight in toward the far side
    const push = R * (PUSH * pr + tremor * 4), px = -Math.cos(rad(DENT[0])), py = -Math.sin(rad(DENT[0]));
    // bell pulse: a quick squeeze then a slow relax, like a jellyfish
    const bell = P.morph * .05 * Math.pow(.5 + .5 * Math.sin(t * .9), 4);
    const sw = P.swell / 2.2;
    for (let j = 0; j < M; j++) {
      const deg = j / M * 360, a = rad(deg);
      let jelly = -bell * Math.cos(2 * a);
      for (const [k, w, amp, ph] of JM) jelly += P.morph * amp * Math.sin(k * a + w * t + ph);
      RR[j] = R * (1 + .05 * Math.cos(rad(deg - 60))) * (1 - DEPTH * DS[j]) * (1 + .3 * pr * LB[j]) * (1 + jelly);
      BL[j] = blurEnv(deg) * MK[j];
      let pulse = 0; for (const [k, w, ph] of SM) pulse += Math.sin(k * a + w * t + ph);
      SW[j] = Math.max(.5, 1 + sw * pulse);
    }
    for (let j = 0; j < M; j++) {
      const a = j / M * TWO_PI, d = push * BU[j];
      LX[j] = CX + RR[j] * Math.cos(a) + px * d; LY[j] = CY + RR[j] * Math.sin(a) + py * d;
    }
    for (let j = 0; j < M; j++) {
      const q = (j + 1) % M, o = (j - 1 + M) % M, tx = LX[q] - LX[o], ty = LY[q] - LY[o];
      const l = Math.hypot(tx, ty) || 1e-3;
      NX[j] = ty / l; NY[j] = -tx / l;                         // outward normal
      SP[j] = l / (2 * TWO_PI / M);                            // px per radian along the line
      // the line stretches thread-thin along the U and gathers at the shoulders
      TH[j] = STROKE * (1 - .5 * DS[j]) * Math.max(.12, 1 - P.thick * .85 * pp * BU[j] - .25 * pp * LB[j]) * (1 + P.thick * .9 * pp * SH[j]);
    }
    const KS = 40;
    for (let j = 0; j < M; j++) {
      let sx = 0, sy = 0;
      for (let k = -KS; k <= KS; k += 4) { const q = (j + k + M) % M; sx += NX[q]; sy += NY[q]; }
      const l = Math.hypot(sx, sy) || 1; HX[j] = sx / l; HY[j] = sy / l;
    }
    // how much the haze spreads or bunches as it moves out from the line (stops dark streaks on inward bends)
    const s0 = 50;
    for (let j = 0; j < M; j++) {
      const q = (j + 1) % M;
      const d0 = Math.hypot(LX[q] - LX[j], LY[q] - LY[j]) || 1e-3;
      const d1 = Math.hypot(LX[q] + HX[q] * s0 - LX[j] - HX[j] * s0, LY[q] + HY[q] * s0 - LY[j] - HY[j] * s0);
      KP[j] = (d1 / d0 - 1) / s0;
    }
  }

  // ---- Particles ----
  let NS, NHZ, sA, sU, sW, sG, sJ, hA, hN, hW, hG, hJs, hJc;
  const GROUPS = 8, OM = Array.from({ length: GROUPS }, (_, g) => .8 + g * .3);
  function build() {
    NS = Math.round(DENSITY * 2.4 * TWO_PI * R * STROKE);
    NHZ = Math.round(DENSITY * 9 * TWO_PI * R * 30);
    sA = new Float32Array(NS); sU = new Float32Array(NS); sW = new Float32Array(NS); sG = new Uint8Array(NS); sJ = new Float32Array(NS);
    hA = new Float32Array(NHZ); hN = new Float32Array(NHZ); hW = new Float32Array(NHZ); hG = new Uint8Array(NHZ);
    hJs = new Float32Array(NHZ); hJc = new Float32Array(NHZ);
    for (let i = 0; i < NS; i++) {
      sA[i] = Math.random(); sU[i] = Math.random() - .5;
      sW[i] = (Math.random() - .5) * .02; sG[i] = (Math.random() * GROUPS) | 0; sJ[i] = Math.random() * 6.28;
    }
    for (let i = 0; i < NHZ; i++) {
      hA[i] = Math.random(); hN[i] = .8 * gauss() + .55;        // biased outward, a little inward
      hW[i] = (Math.random() - .5) * .012; hG[i] = (Math.random() * GROUPS) | 0;
      const j = Math.random() * 6.28; hJs[i] = Math.sin(j); hJc[i] = Math.cos(j);
    }
  }

  const cg = new Float32Array(GROUPS), sg = new Float32Array(GROUPS);

  function render() {
    buildOutline(tau);
    for (let g = 0; g < GROUPS; g++) { cg[g] = Math.cos(OM[g] * tau); sg[g] = Math.sin(OM[g] * tau); }
    const mo = P.motion, sig = P.blur;
    const rot = rad(P.position), cr = Math.cos(rot), sr = Math.sin(rot);
    const place = (x, y) => [CX + (x - CX) * cr - (y - CY) * sr, CY + (x - CX) * sr + (y - CY) * cr];
    K.clear();

    const ws = 1.35 * TWO_PI / NS;                           // the line
    for (let i = 0; i < NS; i++) {
      let a = (sA[i] + sW[i] * mo * tau) % 1; if (a < 0) a += 1;
      const j = (a * M) | 0, vis = 1 - BL[j];
      if (vis < .02) continue;
      const g = sG[i], u = sU[i] + .06 * mo * Math.sin(sJ[i] + OM[g] * tau) * (Math.abs(sU[i]) < .4 ? 1 : 0);
      const th = TH[j], n = u * th;
      const [x, y] = place(LX[j] + NX[j] * n, LY[j] + NY[j] * n);
      K.splat(x, y, vis * ws * SP[j] * th);
    }

    const wh = P.haze * TWO_PI * .8 * sig * 2.5066 / NHZ, A = 2.5 * mo;   // the haze
    for (let i = 0; i < NHZ; i++) {
      let a = (hA[i] + hW[i] * mo * tau) % 1; if (a < 0) a += 1;
      const j = (a * M) | 0, b = BL[j];
      if (b < .02) continue;
      const g = hG[i], ca = cg[g], sa = sg[g];
      const n = hN[i] * sig * SW[j];
      const [x, y] = place(LX[j] + HX[j] * n + A * (hJc[i] * ca - hJs[i] * sa), LY[j] + HY[j] * n + A * (hJs[i] * ca + hJc[i] * sa));
      K.splat(x, y, b * wh * SP[j] / Math.sqrt(SW[j]) / Math.max(.35, 1 + KP[j] * n));
    }
    K.flush(p);
    rec.copy();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(W, W);
    K = Kit.raster(W);
    ({ P } = Kit.panel(p, [
      { id: 'pressure', label: 'Pressure', min: 0, max: 1, step: .01, value: .95 },
      { id: 'resist', label: 'Resist', min: 0, max: 1, step: .01, value: .35 },
      { id: 'thick', label: 'Thickness', min: 0, max: 1, step: .01, value: .7 },
      { id: 'morph', label: 'Morph', min: 0, max: 2, step: .05, value: 1 },
      { id: 'travel', label: 'Travel', min: -40, max: 40, step: 1, value: 12 },
      { id: 'creep', label: 'Creep', min: 0, max: 80, step: 1, value: 30 },
      { id: 'swell', label: 'Swell', min: 0, max: .9, step: .01, value: .4 },
      { id: 'blur', label: 'Blur', min: 8, max: 60, step: 1, value: 30 },
      { id: 'haze', label: 'Haze', min: .1, max: .9, step: .01, value: .42 },
      { id: 'motion', label: 'Motion', min: 0, max: 3, step: .05, value: 1 },
      { id: 'speed', label: 'Speed', min: 0, max: 3, step: .05, value: .6 },
      { id: 'position', label: 'Position', min: 0, max: 360, step: 1, value: 0 },
    ], 'panel bottom-left', () => { dirty = true; }));
    const [, , bg] = Kit.buttons(p, [
      { label: 'Pause', click: (b) => { paused = !paused; b.html(paused ? 'Play' : 'Pause'); } },
      { label: 'Save PNG', click: () => Kit.savePNG(p.canvas, 'pressure-drop') },
      { select: [['White bg', '#fff'], ['Transparent (Chrome)', '']] },
      { label: 'Record', click: (b) => rec.toggle(b) },
    ], 'ui bottom-right');
    rec = Kit.recorder(p.canvas, 'pressure-drop', bg);
    Kit.hideOnH(); Kit.fit(p);
    build();
  };
  p.windowResized = () => Kit.fit(p);
  p.draw = () => {
    const dt = Math.min(.05, p.deltaTime / 1000);
    if (!paused) { tau += dt * P.speed; travelL += dt * P.speed * P.travel; travelR += dt * P.speed * P.travel * .72; }
    if (!paused || dirty) { render(); dirty = false; }
  };
});
