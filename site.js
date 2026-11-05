/* Binar Multimedia — frontend (katalog, keranjang sewa, booking) */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const ICONS = { Proyektor: '📽️', Audio: '🔊', Kamera: '🎥', Lighting: '💡', Display: '🖥️', Streaming: '📡' };
const PRODUCT_IMAGES = {
  'Proyektor 5000 Lumens': 'assets/proyektor.jpg',
  'Layar Proyektor 3x2 m': 'assets/layar.jpg',
  'Sound System 2000 Watt': 'assets/sound.jpg',
  'Mic Wireless (2 unit)': 'assets/mic.jpg',
  'Kamera Mirrorless 4K': 'assets/kamera.jpg',
  'Tripod Video Fluid Head': 'assets/tripod.jpg',
  'Lighting Par LED Set (4 unit)': 'assets/lighting.jpg',
  'LED TV 55 inci + Stand': 'assets/tv.jpg',
  'Laptop Presentasi': 'assets/laptop.jpg',
  'Video Switcher + Streaming Kit': 'assets/video-switcher.jpg'
};

const PRODUCT_GALLERY = {
  'LED TV 55 inci + Stand': [
    'assets/tv.jpg',
    'assets/tv-2.jpg'
  ]
};
  /** Buat elemen dengan teks aman (tanpa innerHTML) */
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  }

  let equipment = [];
  let avail = null;          // sisa stok per id untuk tanggal terpilih
  let category = 'Semua';
  const cart = new Map();    // id -> qty
  let wa = '6281234567890';

  const form = $('#bookForm');
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  form.startDate.min = form.endDate.min = today;
  $('#yr').textContent = new Date().getFullYear();

  async function api(url, opts) {
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Terjadi kesalahan.');
    return data;
  }

  const maxFor = (e) => (avail ? avail[e.id] : e.stock);
  const days = () => {
    const a = form.startDate.value, b = form.endDate.value;
    if (!a || !b || b < a) return 0;
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
  };

  /* ---------- Katalog ---------- */
  function renderChips() {
    const cats = ['Semua', ...new Set(equipment.map((e) => e.category))];
    const box = $('#chips');
    box.replaceChildren(...cats.map((c) => el('button', {
      class: 'chip', role: 'tab', 'aria-selected': String(c === category),
      onclick: () => { category = c; renderChips(); renderGrid(); }
    }, c)));
  }
function renderGrid() {
  const list = equipment.filter(
    (e) => category === 'Semua' || e.category === category
  );

  const grid = $('#grid');

  if (!list.length) {
    grid.replaceChildren(
      el('p', { class: 'muted' }, 'Belum ada peralatan.')
    );
    return;
  }

  grid.replaceChildren(...list.map((e) => {
    const max = maxFor(e);
    const q = cart.get(e.id) || 0;

    const stock = el(
      'span',
      { class: 'stock' + (max <= 1 ? ' low' : '') },
      max <= 0
        ? 'Habis di tanggal ini'
        : (avail ? `Tersedia ${max} unit` : `Stok ${e.stock} unit`)
    );

    const ctl = q
      ? el('div', { class: 'qty' },
          el('button', {
            type: 'button',
            'aria-label': 'Kurangi',
            onclick: () => setQty(e.id, q - 1)
          }, '−'),

          el('output', {}, String(q)),

          el('button', {
            type: 'button',
            'aria-label': 'Tambah',
            onclick: () => setQty(e.id, q + 1)
          }, '+')
        )
      : el('button', {
          class: 'btn-sm',
          type: 'button',
          onclick: () => setQty(e.id, 1),
          ...(max <= 0 ? { disabled: '' } : {})
        }, 'Tambah');

    // Mengambil gambar produk
    const image = PRODUCT_IMAGES[e.name] || '';

    // Mengambil galeri jika produk memiliki lebih dari satu gambar
    const images = PRODUCT_GALLERY[e.name] || (image ? [image] : []);

    const card = el('article', {
      class: 'card',
      style: image ? `--card-image: url("${image}")` : ''
    },

      el('div', {
        class: 'ico',
        'aria-hidden': 'true'
      }, ICONS[e.category] || '🎛️'),

      el('h3', {}, e.name),

      el('p', {}, e.description),

      el('div', { class: 'meta' },
        el('div', {},
          el('div', { class: 'price' },
            rp(e.pricePerDay),
            el('small', {}, ' /hari')
          ),
          stock
        ),
        ctl
      )
    );

    // Klik kartu untuk membuka gambar
    card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;

      if (images.length) {
        openGallery(images);
      }
    });

    return card;
  }));
}
  function setQty(id, q) {
    const e = equipment.find((x) => x.id === id);
    q = Math.max(0, Math.min(q, maxFor(e)));
    if (q) cart.set(id, q); else cart.delete(id);
    renderGrid(); renderCart();
  }

  /* ---------- Keranjang ---------- */
  function renderCart() {
    const rows = [...cart].map(([id, q]) => {
      const e = equipment.find((x) => x.id === id);
      return el('div', { class: 'cart-row' },
        el('div', {}, e.name, el('small', {}, `${rp(e.pricePerDay)} × ${q}`)),
        el('div', { class: 'qty' },
          el('button', { type: 'button', 'aria-label': 'Kurangi', onclick: () => setQty(id, q - 1) }, '−'),
          el('output', {}, String(q)),
          el('button', { type: 'button', 'aria-label': 'Tambah', onclick: () => setQty(id, q + 1) }, '+')));
    });
    $('#cartList').replaceChildren(...(rows.length ? rows : [el('p', { class: 'muted' }, 'Belum ada peralatan. Tambahkan dari katalog.')]));
    const perDay = [...cart].reduce((s, [id, q]) => s + equipment.find((x) => x.id === id).pricePerDay * q, 0);
    const d = days();
    $('#sumDay').textContent = rp(perDay);
    $('#sumDays').textContent = d ? `${d} hari` : '—';
    $('#sumTotal').textContent = rp(perDay * d);
    $('#cartCount').textContent = [...cart.values()].reduce((a, b) => a + b, 0);
  }

  /* Cek stok setiap tanggal berubah */
  async function onDates() {
    const a = form.startDate.value, b = form.endDate.value;
    if (a && (!b || b < a)) form.endDate.value = b < a ? a : b || a;
    form.endDate.min = a || today;
    if (a && form.endDate.value >= a) {
      try {
        avail = await api(`/api/availability?start=${a}&end=${form.endDate.value}`);
        for (const [id, q] of cart) if (q > avail[id]) { if (avail[id] > 0) cart.set(id, avail[id]); else cart.delete(id); }
      } catch { avail = null; }
    } else avail = null;
    renderGrid(); renderCart();
  }
  form.startDate.addEventListener('change', onDates);
  form.endDate.addEventListener('change', onDates);

  /* ---------- Kirim booking ---------- */
  function msg(text, ok) {
    const m = $('#formMsg');
    m.hidden = !text; m.textContent = text || ''; m.className = 'msg' + (ok ? ' ok' : '');
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msg('');
    if (!cart.size) return msg('Pilih minimal satu peralatan dari katalog.');
    if (!days()) return msg('Isi tanggal mulai dan selesai.');
    if (form.name.value.trim().length < 2) return msg('Nama wajib diisi.');
    if (form.phone.value.replace(/\D/g, '').length < 9) return msg('Nomor WhatsApp tidak valid.');

    const btn = $('#submitBtn');
    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const res = await api('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.value, phone: form.phone.value, location: form.location.value, notes: form.notes.value,
          startDate: form.startDate.value, endDate: form.endDate.value,
          items: [...cart].map(([id, qty]) => ({ id, qty }))
        })
      });
      const text = `Halo Binar Multimedia, saya ${form.name.value.trim()}. Saya sudah booking dengan kode ${res.id} ` +
        `untuk tanggal ${form.startDate.value} s/d ${form.endDate.value}. Mohon konfirmasinya.`;
      $('#doneId').textContent = res.id;
      $('#doneTotal').textContent = rp(res.total);
      $('#doneWa').href = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
      $('#done').hidden = false;
      $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' });
      cart.clear(); form.reset(); avail = null;
      await loadEquipment(); renderCart();
    } catch (err) {
      msg(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Kirim Booking';
    }
  });

  /* ---------- Muat data ---------- */
  async function loadEquipment() {
    equipment = await api('/api/equipment');
    renderChips(); renderGrid();
  }
/* ---------- LIGHTBOX GALERI PRODUK ---------- */

const modal = $('#imageModal');
const modalImage = $('#modalImage');
const prevImage = $('#prevImage');
const nextImage = $('#nextImage');
const closeModal = $('#closeModal');
const imageCounter = $('#imageCounter');

let currentGallery = [];
let currentIndex = 0;

// Menampilkan gambar sesuai indeks
function showGalleryImage() {
  if (!modalImage || !imageCounter || !prevImage || !nextImage) {
    return;
  }

  modalImage.src = currentGallery[currentIndex];

  imageCounter.textContent =
    `${currentIndex + 1} / ${currentGallery.length}`;

  prevImage.hidden = currentGallery.length <= 1;
  nextImage.hidden = currentGallery.length <= 1;
}

// Membuka galeri
function openGallery(images) {
  if (!modal || !images.length) return;

  currentGallery = images;
  currentIndex = 0;

  showGalleryImage();

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

// Menutup galeri
function closeGallery() {
  if (!modal) return;

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');

  if (modalImage) {
    modalImage.src = '';
  }
}

// Tombol gambar sebelumnya
if (prevImage) {
  prevImage.addEventListener('click', () => {
    currentIndex =
      (currentIndex - 1 + currentGallery.length) %
      currentGallery.length;

    showGalleryImage();
  });
}

// Tombol gambar berikutnya
if (nextImage) {
  nextImage.addEventListener('click', () => {
    currentIndex =
      (currentIndex + 1) % currentGallery.length;

    showGalleryImage();
  });
}

// Tombol tutup
if (closeModal) {
  closeModal.addEventListener('click', closeGallery);
}

// Klik area gelap untuk menutup
if (modal) {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeGallery();
    }
  });
}

// Navigasi menggunakan keyboard
document.addEventListener('keydown', (event) => {
  if (!modal || !modal.classList.contains('show')) return;

  if (event.key === 'Escape') {
    closeGallery();
  }

  if (event.key === 'ArrowLeft' && prevImage) {
    prevImage.click();
  }

  if (event.key === 'ArrowRight' && nextImage) {
    nextImage.click();
  }
});
  api('/api/config').then((c) => { wa = c.wa; $('#waLink').href = `https://wa.me/${wa}`; }).catch(() => {});
  loadEquipment().then(renderCart).catch(() => {
    $('#grid').replaceChildren(el('p', { class: 'muted' }, 'Katalog gagal dimuat. Pastikan server berjalan (npm start).'));
  });
})();