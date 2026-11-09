// Growth — shared engine for the three "life of a raindrop" pieces (snow, sleet, landing).
// Each piece draws the same base: a ring of particles whose top and bottom smear into soft arcs on a grey ground.
// On top of it, the piece's own particles appear over time (each has a birth time), and a Photoshop-style
// tilt blur (sharp band, blur ramping up through a transition zone) is applied live.
//
// Growth(p, { name, build }) — build(h) returns an array of { x, y, b (birth, seconds), a (alpha) }
// in a 1000 × 1000 design space, using the helpers in h.

function Growth(p, piece) {
  const { gauss, smooth } = Kit;
  const BG = '#5f5f5f';
  const S = 1000, CX = 500, CY = 500;
  const R = 260;           // ring radius
  const OFF = 55;          // smear offset at top/bottom
  const LEVELS = 4;        // blur steps across the transition zone
  const env = a => { const s = Math.sin(a); return s < 0 ? -smooth(.5, .9, -s) : smooth(.5, .9, s); };

  let base, scene, half, tmp, k, sz, dpr, pts = [], idx = 0, t0 = 0, P, rec, ending = false, guides;

  // ---- the shared base ring, drawn once with p5 ----
  function drawBase() {
    base.clear(); base.push(); base.scale(k); base.noStroke();
    for (let i = 0; i < 70000; i++) {                       // crisp ring, fading where the smear takes over
      const a = Math.random() * Math.PI * 2, al = .85 * (1 - Math.abs(env(a)));
      if (al < .02) continue;
      const r = R + gauss() * 1.6;
      base.fill(0, al * 255); base.rect(CX + Math.cos(a) * r, CY + Math.sin(a) * r, sz, sz);
    }
    for (let i = 0; i < 120000; i++) {                      // smeared arcs top and bottom
      const a = Math.random() * Math.PI * 2, e = env(a);
      if (Math.abs(e) < .02) continue;
      const u = Math.pow(Math.random(), .6);
      base.fill(0, .1 * Math.abs(e) * 255);
      base.rect(CX + Math.cos(a) * R + gauss() * 3, CY + Math.sin(a) * R + e * OFF * u + gauss() * (4 + 10 * u), sz, sz);
    }
    base.pop();
  }

  // ---- tilt blur: sharp band, blur ramps up through the transition zone ----
  // (uses the canvas 2D context under p5 for the gradient masks and blur filter)
  function bandGeom() {
    const Wd = p.canvas.width, th = P.angle * Math.PI / 180;
    return { W: Wd, cx: Wd / 2, cy: P.pos * Wd, dx: Math.cos(th), dy: Math.sin(th), nx: -Math.sin(th), ny: Math.cos(th), D: Wd * 1.5 };
  }
  const kd = () => k * dpr;                                 // design units → device pixels
  function mask(ctx, i, g) {
    const D = g.D, t = j => Math.min(D, (P.focus + P.trans * j / LEVELS) * kd());
    let st;
    if (i === 0) st = [[0, 1], [t(0), 1], [t(1), 0], [D, 0]];
    else if (i === LEVELS) st = [[0, 0], [t(i - 1), 0], [t(i), 1], [D, 1]];
    else st = [[0, 0], [t(i - 1), 0], [t(i), 1], [t(i + 1), 0], [D, 0]];
    const o = d => Math.min(1, Math.max(0, .5 + d / (2 * D)));
    const gr = ctx.createLinearGradient(g.cx - g.nx * D, g.cy - g.ny * D, g.cx + g.nx * D, g.cy + g.ny * D);
    for (let j = st.length - 1; j >= 0; j--) gr.addColorStop(o(-st[j][0]), `rgba(0,0,0,${st[j][1]})`);
    for (const [d, a] of st) gr.addColorStop(o(d), `rgba(0,0,0,${a})`);
    return gr;
  }
  function composite(showGuides = guides.checked()) {
    const g = bandGeom(), Wd = g.W, hw = half.elt.width;
    const ctx = p.drawingContext, tctx = tmp.drawingContext, hctx = half.drawingContext;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, Wd, Wd);
    if (P.blur <= 0) ctx.drawImage(scene.elt, 0, 0);
    else for (let i = 0; i <= LEVELS; i++) {
      tctx.save(); tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, Wd, Wd);
      if (i === 0) tctx.drawImage(scene.elt, 0, 0);
      else {
        hctx.save(); hctx.setTransform(1, 0, 0, 1, 0, 0);
        hctx.filter = 'none'; hctx.clearRect(0, 0, hw, hw);
        hctx.filter = `blur(${P.blur * kd() * i / LEVELS * (hw / Wd)}px)`;
        hctx.drawImage(scene.elt, 0, 0, hw, hw); hctx.restore();
        tctx.drawImage(half.elt, 0, 0, Wd, Wd);
      }
      tctx.globalCompositeOperation = 'destination-in';
      tctx.fillStyle = mask(tctx, i, g); tctx.fillRect(0, 0, Wd, Wd); tctx.restore();
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tmp.elt, 0, 0);
    }
    ctx.globalCompositeOperation = 'source-over';
    rec.copy();
    if (showGuides) {                                       // white guide lines, not exported
      const line = d => { const px = g.cx + g.nx * d, py = g.cy + g.ny * d;
        ctx.beginPath(); ctx.moveTo(px - g.dx * g.D, py - g.dy * g.D); ctx.lineTo(px + g.dx * g.D, py + g.dy * g.D); ctx.stroke(); };
      ctx.strokeStyle = '#fff'; ctx.lineWidth = dpr;
      ctx.setLineDash([]); line(-P.focus * kd()); line(P.focus * kd());
      ctx.setLineDash([6 * dpr, 6 * dpr]); line(-(P.focus + P.trans) * kd()); line((P.focus + P.trans) * kd());
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(g.cx, g.cy, 5 * dpr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function restart() {
    pts = piece.build({ gauss, smooth, env, R, CX, CY, OFF });
    pts.sort((a, b) => a.b - b.b); idx = 0;
    scene.clear(); scene.image(base, 0, 0);
    composite();
    t0 = p.millis();
  }
  function endRec() {                                       // let the last frame settle, then stop recording
    if (ending || !rec.rec) return;
    ending = true; let n = 0;
    const iv = setInterval(() => { rec.copy(); if (++n > 15) { clearInterval(iv); rec.stop(); } }, 100);
  }

  function init() {
    const css = Math.min(innerWidth, innerHeight);
    dpr = p.pixelDensity();
    p.resizeCanvas(css, css);
    k = css / S; sz = 1.3 / (k * dpr);
    for (const g of [base, scene, half, tmp]) if (g) g.remove();
    base = p.createGraphics(css, css); scene = p.createGraphics(css, css); tmp = p.createGraphics(css, css);
    half = p.createGraphics(Math.round(css / 2), Math.round(css / 2));
    drawBase(); restart();
  }

  p.setup = () => {
    p.createCanvas(10, 10);
    document.body.style.setProperty('--bg', BG);
    let gEl;
    ({ P, el: gEl } = Kit.panel(p, [
      { id: 'blur', label: 'Blur', min: 0, max: 40, step: .5, value: 14 },
      { id: 'pos', label: 'Position', min: 0, max: 1, step: .01, value: .5, fmt: v => Math.round(v * 100) },
      { id: 'focus', label: 'Focus', min: 0, max: 500, step: 1, value: 170 },
      { id: 'trans', label: 'Transition', min: 0, max: 500, step: 1, value: 220 },
      { id: 'angle', label: 'Angle', min: -90, max: 90, step: 1, value: 0 },
    ], 'panel top-left', () => composite()));
    const lab = p.createElement('label').addClass('chk').parent(gEl);
    guides = p.createCheckbox(' Show guides', false).parent(lab);
    guides.changed(() => composite());
    const [, , bg] = Kit.buttons(p, [
      { label: 'Restart', click: restart },
      { label: 'Save PNG', click: () => { composite(false); Kit.savePNG(p.canvas, piece.name); composite(); } },
      { select: [['White bg', '#fff'], ['Grey bg', BG], ['Transparent (Chrome)', '']] },
      { label: 'Record', click: (b) => { if (rec.rec) endRec(); else if (rec.start(b)) restart(); } },
    ], 'ui bottom-center');
    rec = Kit.recorder(p.canvas, piece.name, bg);
    rec.onStop = () => { ending = false; };
    Kit.hideOnH();
    init();
  };
  let rt; p.windowResized = () => { clearTimeout(rt); rt = setTimeout(init, 200); };

  // ---- animation: particles appear once their birth time has passed ----
  p.draw = () => {
    if (idx >= pts.length) { if (rec.rec) endRec(); return; }
    const t = (p.millis() - t0) / 1000;
    let added = false;
    scene.push(); scene.scale(k); scene.noStroke();
    while (idx < pts.length && pts[idx].b <= t) {
      const q = pts[idx++];
      scene.fill(0, q.a * 255); scene.rect(q.x, q.y, sz, sz);
      added = true;
    }
    scene.pop();
    if (added) composite();
  };
}
