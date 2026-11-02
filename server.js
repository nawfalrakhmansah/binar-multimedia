'use strict';
/* BINAR MULTIMEDIA — backend (Express + penyimpanan file JSON) */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';   // ganti lewat environment!
const WA_NUMBER = process.env.WA_NUMBER || '6285147033372';       // format internasional tanpa +
const DB_FILE = path.join(__dirname, 'data', 'db.json');

/* ---------- Data ---------- */
const SEED = [
  ['Proyektor 5000 Lumens', 'Proyektor', 250000, 4, 'Full HD, HDMI/VGA, cocok untuk seminar & rapat besar.'],
  ['Layar Proyektor 3x2 m', 'Proyektor', 100000, 4, 'Layar tripod/fastfold, mudah dipasang.'],
  ['Sound System 2000 Watt', 'Audio', 600000, 3, 'Speaker aktif + mixer 8 channel, untuk indoor 150–300 orang.'],
  ['Mic Wireless (2 unit)', 'Audio', 120000, 6, 'Handheld wireless UHF, jangkauan stabil.'],
  ['Kamera Mirrorless 4K', 'Kamera', 450000, 3, 'Lensa kit, baterai cadangan, memori 128 GB.'],
  ['Tripod Video Fluid Head', 'Kamera', 75000, 5, 'Kokoh untuk live streaming dan dokumentasi.'],
  ['Lighting Par LED Set (4 unit)', 'Lighting', 300000, 5, 'RGBW, DMX, cocok untuk panggung & dekorasi.'],
  ['LED TV 55 inci + Stand', 'Display', 350000, 4, 'Smart TV 4K dengan standing mobile.'],
  ['Laptop Presentasi', 'Display', 200000, 4, 'Siap pakai, terpasang aplikasi presentasi & pemutar media.'],
  ['Video Switcher + Streaming Kit', 'Streaming', 700000, 2, 'ATEM-style switcher, capture card, siap live YouTube/Zoom.']
];

function freshDb() {
  return {
    equipment: SEED.map((s, i) => ({ id: i + 1, name: s[0], category: s[1], pricePerDay: s[2], stock: s[3], description: s[4] })),
    bookings: [],
    seq: { equipment: SEED.length, booking: 0 }
  };
}
function save(d) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { const d = freshDb(); save(d); return d; }
}
let db = load();

/* ---------- Util ---------- */
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const dayNum = (s) => Math.floor(Date.parse(s) / 86400000);
const todayStr = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); // WIB
const overlap = (a, b) => a.startDate <= b.endDate && b.startDate <= a.endDate;
const STATUSES = ['pending', 'confirmed', 'done', 'cancelled'];

function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi sebentar.' });
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}

const tokens = new Map(); // token -> expiry
function adminOnly(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  const exp = tokens.get(t);
  if (!exp || exp < Date.now()) return res.status(401).json({ error: 'Sesi admin berakhir, silakan login lagi.' });
  next();
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

/* ---------- App ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});
app.use(express.static(path.join(__dirname)));

/* ----- Publik ----- */
app.get('/api/config', (req, res) => res.json({ wa: WA_NUMBER }));
app.get('/api/equipment', (req, res) => res.json(db.equipment));

// Sisa stok per peralatan untuk rentang tanggal tertentu
function availability(startDate, endDate) {
  const range = { startDate, endDate };
  const used = {};
  for (const b of db.bookings) {
    if (!['pending', 'confirmed'].includes(b.status) || !overlap(range, b)) continue;
    for (const it of b.items) used[it.id] = (used[it.id] || 0) + it.qty;
  }
  return used;
}
app.get('/api/availability', (req, res) => {
  const { start, end } = req.query;
  if (!isDate(start) || !isDate(end) || end < start) return res.status(400).json({ error: 'Tanggal tidak valid.' });
  const used = availability(start, end);
  res.json(Object.fromEntries(db.equipment.map((e) => [e.id, Math.max(0, e.stock - (used[e.id] || 0))])));
});

app.post('/api/bookings', limiter(8, 10 * 60 * 1000), (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 80), phone = clean(b.phone, 20).replace(/[^\d+]/g, '');
  const location = clean(b.location, 160), notes = clean(b.notes, 400);
  const startDate = clean(b.startDate, 10), endDate = clean(b.endDate, 10);

  if (name.length < 2) return res.status(400).json({ error: 'Nama wajib diisi.' });
  if (phone.replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
  if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) return res.status(400).json({ error: 'Tanggal sewa tidak valid.' });
  if (startDate < todayStr()) return res.status(400).json({ error: 'Tanggal mulai tidak boleh di masa lalu.' });
  const days = dayNum(endDate) - dayNum(startDate) + 1;
  if (days > 30) return res.status(400).json({ error: 'Maksimal sewa online 30 hari. Hubungi kami untuk durasi lebih panjang.' });
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) return res.status(400).json({ error: 'Pilih minimal satu peralatan.' });

  const used = availability(startDate, endDate);
  const items = [];
  let perDay = 0;
  for (const raw of b.items) {
    const id = Number(raw.id), qty = Math.floor(Number(raw.qty));
    const eq = db.equipment.find((e) => e.id === id);
    if (!eq || !(qty >= 1)) return res.status(400).json({ error: 'Data peralatan tidak valid.' });
    const left = eq.stock - (used[id] || 0);
    if (qty > left) return res.status(409).json({ error: `Stok "${eq.name}" untuk tanggal tersebut tinggal ${Math.max(0, left)} unit.` });
    items.push({ id, name: eq.name, qty, pricePerDay: eq.pricePerDay });
    perDay += eq.pricePerDay * qty;
  }

  const booking = {
    id: 'BM-' + String(++db.seq.booking).padStart(4, '0'),
    createdAt: new Date().toISOString(),
    status: 'pending',
    name, phone, location, notes, startDate, endDate, days, items,
    total: perDay * days
  };
  db.bookings.unshift(booking);
  save(db);
  res.status(201).json({ id: booking.id, total: booking.total, days });
});

/* ----- Admin ----- */
app.post('/api/admin/login', limiter(10, 10 * 60 * 1000), (req, res) => {
  const ok = crypto.timingSafeEqual(sha(req.body && req.body.password), sha(ADMIN_PASSWORD));
  if (!ok) return res.status(401).json({ error: 'Password salah.' });
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, Date.now() + 12 * 3600000);
  res.json({ token });
});

app.get('/api/admin/bookings', adminOnly, (req, res) => res.json(db.bookings));
app.patch('/api/admin/bookings/:id', adminOnly, (req, res) => {
  const bk = db.bookings.find((x) => x.id === req.params.id);
  if (!bk) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (!STATUSES.includes(req.body && req.body.status)) return res.status(400).json({ error: 'Status tidak valid.' });
  bk.status = req.body.status;
  save(db);
  res.json(bk);
});

function readEquipment(body, base = {}) {
  const e = {
    name: clean(body.name ?? base.name, 80),
    category: clean(body.category ?? base.category, 30),
    description: clean(body.description ?? base.description, 200),
    pricePerDay: Math.floor(Number(body.pricePerDay ?? base.pricePerDay)),
    stock: Math.floor(Number(body.stock ?? base.stock))
  };
  if (!e.name || !e.category || !(e.pricePerDay > 0) || !(e.stock >= 0)) return null;
  return e;
}
app.post('/api/admin/equipment', adminOnly, (req, res) => {
  const e = readEquipment(req.body || {});
  if (!e) return res.status(400).json({ error: 'Data peralatan tidak lengkap.' });
  e.id = ++db.seq.equipment;
  db.equipment.push(e);
  save(db);
  res.status(201).json(e);
});
app.put('/api/admin/equipment/:id', adminOnly, (req, res) => {
  const eq = db.equipment.find((x) => x.id === Number(req.params.id));
  if (!eq) return res.status(404).json({ error: 'Peralatan tidak ditemukan.' });
  const e = readEquipment(req.body || {}, eq);
  if (!e) return res.status(400).json({ error: 'Data peralatan tidak valid.' });
  Object.assign(eq, e);
  save(db);
  res.json(eq);
});
app.delete('/api/admin/equipment/:id', adminOnly, (req, res) => {
  const i = db.equipment.findIndex((x) => x.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'Peralatan tidak ditemukan.' });
  db.equipment.splice(i, 1);
  save(db);
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
app.use((err, req, res, next) => {          // JSON rusak, dsb.
  res.status(err.status || 500).json({ error: err.status ? 'Permintaan tidak valid.' : 'Terjadi kesalahan server.' });
});

app.listen(PORT, () => {
  console.log(`Binar Multimedia berjalan di http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html  (password: ${process.env.ADMIN_PASSWORD ? '(dari environment)' : 'admin123 — GANTI!'})`);
});
