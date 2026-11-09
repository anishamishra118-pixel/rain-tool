// Kit — small shared helpers for the p5 sketches (instance mode).
// UI panels and buttons built with p5's DOM functions, PNG / video export, H to hide the controls,
// and a particle "raster": an ink buffer that particles are splatted into, then written to p5's pixels.

const Kit = {};

Kit.gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
Kit.smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
Kit.band = (x, a, b, r) => Kit.smooth(a, a + r, x) * (1 - Kit.smooth(b - r, b, x));
Kit.norm360 = d => ((d % 360) + 360) % 360;
Kit.rnd3 = () => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
Kit.wobble = (t, p) => (Math.sin(t * .37 + p[0]) + .6 * Math.sin(t * .91 + p[1]) + .35 * Math.sin(t * 1.73 + p[2])) / 1.95;

// A slider panel. spec: [{ id, label, min, max, step, value, fmt? }]. Returns { P, el }.
// onInput(id) is called whenever a slider moves; onChange(id) when it is released.
Kit.panel = (p, spec, cls = 'panel top-left', onInput = () => {}, onChange = () => {}) => {
  const P = {}, el = p.createDiv().addClass(cls);
  for (const s of spec) {
    p.createSpan(s.label).parent(el);
    const sl = p.createSlider(s.min, s.max, s.value, s.step).parent(el);
    const out = p.createSpan('').addClass('out').parent(el);
    const read = () => { P[s.id] = +sl.value(); out.html(s.fmt ? s.fmt(P[s.id]) : P[s.id]); };
    read();
    sl.input(() => { read(); onInput(s.id); });
    sl.changed(() => { read(); onChange(s.id); });
    P['_' + s.id] = sl;
  }
  return { P, el };
};

// A row of buttons / a background select. items: [{ label, click } | { select: [[label, value], ...] }]
Kit.buttons = (p, items, cls = 'ui top-right') => {
  const el = p.createDiv().addClass(cls), made = [];
  for (const it of items) {
    if (it.select) {
      const s = p.createSelect().parent(el);
      for (const [label, value] of it.select) s.option(label, value);
      made.push(s);
    } else {
      const b = p.createButton(it.label).parent(el);
      b.mousePressed(() => it.click(b));
      made.push(b);
    }
  }
  return made;
};

Kit.download = (blob, file) => {
  const l = document.createElement('a'); l.href = URL.createObjectURL(blob);
  l.download = file; l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 1000);
};
Kit.savePNG = (canvas, name) => canvas.toBlob(b => Kit.download(b, name + '.png'));

// Video recorder: copies the canvas (over an optional background colour) into a recording each frame.
Kit.recorder = (canvas, name, bgSelect) => {
  const rc = document.createElement('canvas'), rctx = rc.getContext('2d');
  const R = { rec: null, onStop: null };
  R.copy = () => {
    if (!R.rec) return;
    rctx.clearRect(0, 0, rc.width, rc.height);
    const bg = bgSelect ? bgSelect.value() : '';
    if (bg) { rctx.fillStyle = bg; rctx.fillRect(0, 0, rc.width, rc.height); }
    rctx.drawImage(canvas, 0, 0, rc.width, rc.height);
  };
  R.start = (btn) => {
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!type) { alert('Video recording is not supported in this browser. Try Chrome.'); return false; }
    rc.width = canvas.width; rc.height = canvas.height;
    const chunks = [];
    R.rec = new MediaRecorder(rc.captureStream(30), { mimeType: type, videoBitsPerSecond: 12e6 });
    R.rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    R.rec.onstop = () => {
      Kit.download(new Blob(chunks, { type }), name + (type.includes('mp4') ? '.mp4' : '.webm'));
      R.rec = null; if (btn) btn.html('Record'); if (R.onStop) R.onStop();
    };
    R.copy(); R.rec.start(); if (btn) btn.html('Stop');
    return true;
  };
  R.stop = () => { if (R.rec) R.rec.stop(); };
  R.toggle = (btn) => R.rec ? R.stop() : R.start(btn);
  return R;
};

// Press H to hide / show all controls
Kit.hideOnH = () => addEventListener('keydown', e => { if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hidden'); });

// Show a fixed-size canvas as large as fits the window (square)
Kit.fit = (p) => { const s = Math.min(innerWidth, innerHeight); p.canvas.style.width = p.canvas.style.height = s + 'px'; };

// ---- Particle raster: black ink with alpha = accumulated density ----
Kit.raster = (W) => {
  const acc = new Float32Array(W * W), K = { acc, W };
  K.clear = () => acc.fill(0);
  // a point, shared between the 4 pixels it falls between
  K.splat = (x, y, w) => {
    const x0 = x | 0, y0 = y | 0;
    if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= W - 1) return;
    const fx = x - x0, fy = y - y0, i = y0 * W + x0;
    acc[i] += w * (1 - fx) * (1 - fy); acc[i + 1] += w * fx * (1 - fy);
    acc[i + W] += w * (1 - fx) * fy; acc[i + W + 1] += w * fx * fy;
  };
  // tiny spheres: a domed, anti-aliased round dot (4×4 sub-pixel positions, cached per size)
  const cache = new Map();
  K.kernels = (d) => {
    const key = Math.round(d * 4) / 4;
    if (cache.has(key)) return cache.get(key);
    const r = key / 2, h = Math.ceil(r + .5), n = 2 * h + 1, set = [];
    for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
      const fx = px / 4, fy = py / 4, k = new Float32Array(n * n); let sum = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        let v = 0;
        for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
          const dx = i - h + (sx + .5) / 4 - .5 - fx, dy = j - h + (sy + .5) / 4 - .5 - fy, q = (dx * dx + dy * dy) / (r * r);
          if (q < 1) v += Math.sqrt(1 - q);
        }
        k[j * n + i] = v; sum += v;
      }
      for (let t = 0; t < k.length; t++) k[t] /= sum || 1;
      set.push(k);
    }
    const out = { h, n, set }; cache.set(key, out); return out;
  };
  K.splatK = (x, y, w, Kn) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), h = Kn.h, n = Kn.n;
    if (x0 - h < 0 || y0 - h < 0 || x0 + h >= W || y0 + h >= W) return;
    const k = Kn.set[(((y - y0) * 4) | 0) * 4 + (((x - x0) * 4) | 0)];
    let o = (y0 - h) * W + x0 - h, t = 0;
    for (let j = 0; j < n; j++, o += W) for (let i = 0; i < n; i++, t++) { const v = k[t]; if (v) acc[o + i] += w * v; }
  };
  // a solid little sphere with a soft anti-aliased rim
  K.ball = (x, y, r, a) => {
    if (r < .4 || a <= 0) return;
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(W - 1, Math.ceil(x + r + 1));
    const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(W - 1, Math.ceil(y + r + 1));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + .5 - x, py + .5 - y), cov = Math.min(1, Math.max(0, r - d + .5));
      if (cov > 0) acc[py * W + px] += a * cov * Math.min(1, 2.4 * Math.sqrt(Math.max(0, 1 - (d * d) / (r * r))) + .25);
    }
  };
  // write the ink into p5's pixels: black, alpha = density (transparent where empty)
  K.flush = (p) => {
    p.loadPixels();
    const u32 = new Uint32Array(p.pixels.buffer, p.pixels.byteOffset, W * W);
    for (let i = 0, n = W * W; i < n; i++) {
      const v = acc[i];
      u32[i] = v <= 0 ? 0 : (v >= 1 ? 255 : (v * 255) | 0) << 24;
    }
    p.updatePixels();
  };
  return K;
};
