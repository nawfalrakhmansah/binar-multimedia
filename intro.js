/* ==========================================================
   BINAR MULTIMEDIA — Cinematic Intro
   - Satu timeline mengatur semua fase (kelas CSS p-* + canvas).
   - Canvas hanya menggambar partikel (sprite) + garis neon: ringan.
   ========================================================== */
(() => {
  'use strict';

  // Sudah pernah lihat intro di sesi ini? Langsung ke halaman utama (tambahkan ?intro untuk memutar lagi)
  try {
    if (sessionStorage.getItem('introSeen') && !location.search.includes('intro')) {
      location.replace('home.html');
      return;
    }
  } catch (e) {}

  const TOTAL = 5650;   // ms, durasi total intro
  const CY = 0.5;       // posisi vertikal titik fokus (tengah layar)

  // [waktu mulai (ms), kelas yang ditambahkan ke #intro]
  const PHASES = [
    [250,  'p-core'],     // titik cahaya kecil + cahaya menyebar
    [850,  'p-energy'],   // garis neon, partikel, pusaran energi
    [1400, 'p-square'],   // titik membesar jadi kotak
    [1950, 'p-logo'],     // kotak berputar 3D jadi huruf B
    [2500, 'p-orbit'],    // orbit neon + kilatan menyapu
    [2750, 'p-text'],     // nama brand meluncur keluar
    [4500, 'p-converge'], // cahaya berkumpul ke tengah
    [4850, 'p-flash'],    // kilatan terakhir pada logo
    [5050, 'p-out']       // transisi keluar
  ];

  const intro  = document.getElementById('intro');
  const canvas = document.getElementById('fx');
  const ctx    = canvas.getContext('2d');
  const skipBtn   = document.getElementById('skip');
  const replayBtn = document.getElementById('replay');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const sm = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

  /* ---------- Pecah judul menjadi huruf ---------- */
  let idx = 0;
  document.querySelectorAll('.word').forEach((w) => {
    const txt = w.textContent.trim();
    w.setAttribute('aria-hidden', 'true');
    w.textContent = '';
    for (const c of txt) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', idx++);
      s.textContent = c;
      w.appendChild(s);
    }
  });

  /* ---------- Canvas ---------- */
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H * CY;
    R = Math.hypot(W, H) / 2;
  }

  // Sprite cahaya dibuat sekali lalu dipakai ulang (lebih ringan dari shadowBlur)
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  (() => {
    const g = sprite.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(150,215,255,.9)');
    gr.addColorStop(0.5, 'rgba(40,120,255,.25)');
    gr.addColorStop(1, 'rgba(20,80,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  })();

  let parts = [];
  let streaks = [];

  function newStreak(s, initial) {
    s.radial = Math.random() < 0.6;
    s.p = initial ? rand(-0.2, 1) : rand(-0.5, 0);
    s.w = rand(0.8, 2);
    if (s.radial) {
      s.ang = rand(0, Math.PI * 2);
      s.speed = rand(0.45, 1);
      s.len = rand(0.12, 0.3) * R;
    } else {
      s.horiz = Math.random() < 0.5;
      const dim = s.horiz ? H : W;
      s.off = (Math.random() < 0.5 ? -1 : 1) * rand(0.14, 0.45) * dim;
      s.dir = Math.random() < 0.5 ? -1 : 1;
      s.speed = rand(0.6, 1.2);
      s.len = rand(0.15, 0.35) * (s.horiz ? W : H);
    }
    return s;
  }

  function initFx() {
    const small = W < 600;
    const n = reduce ? 40 : small ? 70 : 115;
    parts = Array.from({ length: n }, () => ({
      a: rand(0, Math.PI * 2),
      r: Math.pow(Math.random(), 0.7) * 0.9 + 0.05,
      w: rand(0.15, 0.55) * (Math.random() < 0.85 ? 1 : -1),
      s: rand(6, 20) * (small ? 0.8 : 1),
      sp: rand(0.8, 2.2),
      ph: rand(0, 6.28),
      b: Math.random(),
      o: rand(0.5, 1)
    }));
    streaks = Array.from({ length: small ? 10 : 16 }, () => newStreak({}, true));
  }

  function drawStreak(x1, y1, x2, y2, width, alpha) {
    if (alpha <= 0.01) return;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(190,235,255,1)');
    g.addColorStop(0.25, 'rgba(70,160,255,.7)');
    g.addColorStop(1, 'rgba(40,110,255,0)');
    ctx.strokeStyle = g;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.globalAlpha = alpha * 0.22;
    ctx.lineWidth = width * 4;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const time = t / 1000;

    // --- parameter animasi (berbasis waktu timeline) ---
    const inten = sm(250, 1500, t);
    const grow  = 0.25 + 0.75 * sm(300, 2100, t);
    // energi tertarik ke pusat saat logo terbentuk, lalu memancar keluar
    const dip   = t < 1950 ? 1 - 0.85 * sm(1400, 1950, t) : 0.15 + 0.85 * sm(2000, 2700, t);
    const pull  = 1 - sm(4500, 4850, t);
    const f     = dip * pull * grow;
    const spin  = (reduce ? 0.3 : 1) *
      (1 + 2 * sm(800, 1400, t) - 2 * sm(1950, 2600, t) + 1.8 * sm(4500, 4850, t));
    const fade  = 1 - sm(4850, 5050, t);

    // --- garis neon ---
    const active = Math.round(streaks.length * sm(800, 1500, t));
    const boost = 1 + 2.2 * sm(4500, 4800, t);
    for (let i = 0; i < active; i++) {
      const s = streaks[i];
      s.p += s.speed * boost * dt * (s.radial ? 0.9 : 0.7);
      if (s.p > 1.05) { newStreak(s, false); continue; }
      if (s.p < 0) continue;
      const a = sm(0, 0.15, s.p) * (1 - sm(0.8, 1, s.p)) * fade;
      if (s.radial) {
        const d = (1 - s.p) * R * 1.05;
        const ux = Math.cos(s.ang), uy = Math.sin(s.ang);
        const hx = cx + ux * d, hy = cy + uy * d;
        drawStreak(hx, hy, hx + ux * s.len, hy + uy * s.len, s.w, a);
      } else if (s.horiz) {
        const y = cy + s.off;
        const hx = s.dir > 0 ? s.p * W : W * (1 - s.p);
        drawStreak(hx, y, hx - s.dir * s.len, y, s.w, a * 0.8);
      } else {
        const x = cx + s.off;
        const hy = s.dir > 0 ? s.p * H : H * (1 - s.p);
        drawStreak(x, hy, x, hy - s.dir * s.len, s.w, a * 0.8);
      }
    }

    // --- partikel cahaya ---
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const vis = clamp01((inten - p.b * 0.9) * 6);
      if (vis <= 0) continue;
      p.a += p.w * spin * dt;
      const rr = (p.r + Math.sin(time * p.sp + p.ph) * 0.04) * R * 0.75 * f;
      const x = cx + Math.cos(p.a) * rr;
      const y = cy + Math.sin(p.a) * rr * 0.82;
      const tw = 0.55 + 0.45 * Math.sin(time * p.sp * 2 + p.ph);
      ctx.globalAlpha = vis * tw * p.o * fade;
      ctx.drawImage(sprite, x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Timeline ---------- */
  let t0 = 0, last = 0, raf = 0, running = false, phaseIdx = 0, endTimer = 0;

  function frame(now) {
    const t = now - t0;
    while (phaseIdx < PHASES.length && t >= PHASES[phaseIdx][0]) {
      intro.classList.add(PHASES[phaseIdx][1]);
      phaseIdx++;
    }
    if (t >= TOTAL) { finish(); return; }
    draw(t, Math.min((now - last) / 1000, 0.05));
    last = now;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    clearTimeout(endTimer);
    cancelAnimationFrame(raf);
    document.body.classList.remove('ended');
    intro.className = 'intro';
    intro.hidden = false;
    void intro.offsetWidth;            // paksa reflow agar animasi mulai dari awal
    resize();
    initFx();
    phaseIdx = 0;
    running = true;
    t0 = last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    window.location.replace('home.html');
  }

  function skip() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    intro.classList.add('is-skipping');
    endTimer = setTimeout(finish, 320);
  }

  skipBtn.addEventListener('click', skip);
  replayBtn.addEventListener('click', start);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (running) { resize(); initFx(); } }, 120);
  });

  /* Tunggu font siap (maks. 900 ms) supaya teks tidak "melompat" saat muncul */
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('1em Michroma'),
        document.fonts.load('500 1em Manrope'),
        document.fonts.load('300 1em Manrope')
      ]).catch(() => {})
    : Promise.resolve();

  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(start);
})();