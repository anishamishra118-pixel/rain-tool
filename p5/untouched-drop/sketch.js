// Untouched Drop — p5.js
// "Raindrop, untouched by air pressure or resistance": a barely breathing ring of particles,
// with two arcs where the line loosens and dissolves into a grey particle haze.
// Press H to hide the controls.

new p5((p) => {
  const { gauss, smooth, band, norm360, rnd3, wobble } = Kit;

  // ---- Form (canvas pixels; angles are screen degrees, 0 = right, 90 = bottom) ----
  const W = 1200, CX = 600, CY = 600;
  const R = 360;            // radius
  const STROKE = 13;        // line thickness
  // Haze profile, measured from the drawing: a grey band centred on the line, ~25% grey at its peak
  const HZ_SD = .78;        // spread (× Blur)
  const DENSITY = 1;        // particle density multiplier
  const M = 2048;           // samples round the outline per frame
  const TWO_PI = Math.PI * 2;

  // Where the line dissolves into haze: an upper-left arc and a lower-right arc. Each of the four meeting
  // points between line and haze drifts on its own irregular rhythm, so the haze grows and recedes in place.
  const BASE = [182, 275, -7, 108], EDGE = [...BASE];
  const arc = (deg, a, b, r) => { const c = (a + b) / 2; let d = norm360(deg - c); if (d > 180) d -= 360; return band(c + d, a, b, r); };
  const blurEnv = (deg) => Math.max(arc(deg, EDGE[0], EDGE[1], 16), arc(deg, EDGE[2], EDGE[3], 20));
  const ESEED = [rnd3(), rnd3(), rnd3(), rnd3()];
  const moveEdges = (t) => {
    EDGE[0] = BASE[0] - P.creep * wobble(t, ESEED[0]); EDGE[1] = BASE[1] + P.creep * wobble(t, ESEED[1]);
    EDGE[2] = BASE[2] - P.creep * wobble(t, ESEED[2]); EDGE[3] = BASE[3] + P.creep * wobble(t, ESEED[3]);
  };

  let P, K, rec, paused = false, dirty = false, tau = 0;

  // ---- Per-frame outline table ----
  const LX = new Float32Array(M), LY = new Float32Array(M), NX = new Float32Array(M), NY = new Float32Array(M);
  const TH = new Float32Array(M), SP = new Float32Array(M), BL = new Float32Array(M), SW = new Float32Array(M);
  // barely breathing: a slow, faint swell of the whole ring plus the faintest ripples
  const JM = [[2, -.31, .006], [3, .23, .004], [5, -.17, .002]].map(([k, w, a]) => [k, w, a, Math.random() * 6.28]);
  const SM = [[2, .23], [3, .41], [4, .29]].map(([k, w]) => [k, w, Math.random() * 6.28]);

  function buildOutline(t) {
    moveEdges(t);
    const breath = P.breathe * .012 * Math.sin(t * .45), sw = P.swell / 2.2;
    for (let j = 0; j < M; j++) {
      const a = j / M * TWO_PI;
      let r = 1 + breath;
      for (const [k, w, amp, ph] of JM) r += P.breathe * amp * Math.sin(k * a + w * t + ph);
      r *= R;
      LX[j] = CX + r * Math.cos(a); LY[j] = CY + r * Math.sin(a);
      NX[j] = Math.cos(a); NY[j] = Math.sin(a); SP[j] = r; TH[j] = STROKE;
      BL[j] = blurEnv(j / M * 360);
      let pulse = 0; for (const [k, w, ph] of SM) pulse += Math.sin(k * a + w * t + ph);
      SW[j] = Math.max(.5, 1 + sw * pulse);        // uneven outward swell of the haze
    }
  }

  // ---- Particles ----
  let NS, NHZ, sA, sU, sW, sG, sJ, sS, hA, hN, hW, hG, hJs, hJc;
  const GROUPS = 8, OM = Array.from({ length: GROUPS }, (_, g) => .8 + g * .3);
  function build() {
    NS = Math.round(DENSITY * 2.4 * TWO_PI * R * STROKE);       // the line
    NHZ = Math.round(DENSITY * 9 * TWO_PI * R * 30);            // the haze
    sA = new Float32Array(NS); sU = new Float32Array(NS); sW = new Float32Array(NS); sG = new Uint8Array(NS); sJ = new Float32Array(NS); sS = new Float32Array(NS);
    hA = new Float32Array(NHZ); hN = new Float32Array(NHZ); hW = new Float32Array(NHZ); hG = new Uint8Array(NHZ);
    hJs = new Float32Array(NHZ); hJc = new Float32Array(NHZ);
    for (let i = 0; i < NS; i++) {
      sA[i] = Math.random(); sU[i] = Math.random() - .5;
      sW[i] = (Math.random() - .5) * .02;                          // drift along the line, both ways
      sG[i] = (Math.random() * GROUPS) | 0; sJ[i] = Math.random() * 6.28;
      sS[i] = gauss() * (Math.random() < .12 ? 2.5 : 1);           // scatter; a few strays wander further
    }
    for (let i = 0; i < NHZ; i++) {
      hA[i] = Math.random(); hN[i] = gauss();
      hW[i] = (Math.random() - .5) * .012; hG[i] = (Math.random() * GROUPS) | 0;
      const j = Math.random() * 6.28; hJs[i] = Math.sin(j); hJc[i] = Math.cos(j);
    }
  }

  const cg = new Float32Array(GROUPS), sg = new Float32Array(GROUPS);

  function render() {
    buildOutline(tau);
    for (let g = 0; g < GROUPS; g++) { cg[g] = Math.cos(OM[g] * tau); sg[g] = Math.sin(OM[g] * tau); }
    const mo = P.motion, sig = P.blur;
    const rot = P.position * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    const place = (x, y) => [CX + (x - CX) * cr - (y - CY) * sr, CY + (x - CX) * sr + (y - CY) * cr];
    K.clear();

    // the line: solid where crisp, loosening and fading where the haze takes over
    const ws = 1.7 * TWO_PI / NS;
    for (let i = 0; i < NS; i++) {
      let a = (sA[i] + sW[i] * mo * tau) % 1; if (a < 0) a += 1;
      const j = (a * M) | 0, vis = Math.pow(1 - BL[j], 1.3);
      if (vis < .02) continue;
      const g = sG[i], u = sU[i] + .06 * mo * Math.sin(sJ[i] + OM[g] * tau) * (Math.abs(sU[i]) < .4 ? 1 : 0);
      const loose = P.loose * (1.2 + 22 * Math.pow(BL[j], .7));   // a light scatter, opening up near the haze
      const th = TH[j], n = u * th + sS[i] * loose * (Math.abs(sU[i]) > .3 ? 1 : .35);
      const [x, y] = place(LX[j] + NX[j] * n, LY[j] + NY[j] * n);
      K.splat(x, y, vis * ws * SP[j] * th);
    }

    // the haze: grey band of sharp particles in the blurred arcs
    const wh = TWO_PI * 2.5066 / NHZ, A = 2 * mo;
    for (let i = 0; i < NHZ; i++) {
      let a = (hA[i] + hW[i] * mo * tau) % 1; if (a < 0) a += 1;
      const j = (a * M) | 0, b = BL[j];
      if (b < .02) continue;
      const g = hG[i], ca = cg[g], sa = sg[g];
      const sd = HZ_SD * sig * SW[j] * (.25 + .75 * b), n = hN[i] * sd;   // narrows toward its ends
      const [x, y] = place(LX[j] + NX[j] * n + A * (hJc[i] * ca - hJs[i] * sa), LY[j] + NY[j] * n + A * (hJs[i] * ca + hJc[i] * sa));
      const tone = P.haze + (1 - P.haze) * (1 - b);                        // grey in the middle, darker where it meets the line
      K.splat(x, y, tone * wh * SP[j] * sd / (1 + n / R));
    }
    K.flush(p);
    rec.copy();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(W, W);
    K = Kit.raster(W);
    ({ P } = Kit.panel(p, [
      { id: 'breathe', label: 'Breathe', min: 0, max: 1, step: .01, value: .35 },
      { id: 'creep', label: 'Creep', min: 0, max: 80, step: 1, value: 30 },
      { id: 'swell', label: 'Swell', min: 0, max: .9, step: .01, value: .3 },
      { id: 'loose', label: 'Loose', min: 0, max: 1, step: .01, value: .5 },
      { id: 'blur', label: 'Blur', min: 8, max: 70, step: 1, value: 30 },
      { id: 'haze', label: 'Haze', min: .1, max: .9, step: .01, value: .26 },
      { id: 'motion', label: 'Motion', min: 0, max: 3, step: .05, value: 1 },
      { id: 'speed', label: 'Speed', min: 0, max: 3, step: .05, value: .6 },
      { id: 'position', label: 'Position', min: 0, max: 360, step: 1, value: 0 },
    ], 'panel bottom-left', () => { dirty = true; }));
    const [, , bg] = Kit.buttons(p, [
      { label: 'Pause', click: (b) => { paused = !paused; b.html(paused ? 'Play' : 'Pause'); } },
      { label: 'Save PNG', click: () => Kit.savePNG(p.canvas, 'untouched-drop') },
      { select: [['White bg', '#fff'], ['Transparent (Chrome)', '']] },
      { label: 'Record', click: (b) => rec.toggle(b) },
    ], 'ui bottom-right');
    rec = Kit.recorder(p.canvas, 'untouched-drop', bg);
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
