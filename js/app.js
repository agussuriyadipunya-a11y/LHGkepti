// ==============================================================================
// LENTERA HATI GURINDAM - MODERN DASHBOARD APPLICATION LOGIC
// ==============================================================================
'use strict';

// ==============================================================================
// SUPABASE ONLINE DATABASE INTEGRATION CONFIGURATION
// ==============================================================================
const SUPABASE_CONFIG = {
  url: 'https://eimjtamfuyeyhqhfumur.supabase.co',
  publishableKey: 'sb_publishable_QJjkH8m-pQeJQai4R2OQCw_trYdYVeq',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWp0YW1mdXlleWhxaGZ1bXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTM1NDEsImV4cCI6MjEwNDg4OTU0MX0.yfvkJzKd1paoDELrcZZzcpUskO8tdcR83FhXjeTotCY'
};

// SUPABASE HTTP REST HELPER
const SupabaseAPI = {
  headers: {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  isOnline: false,
  checkConnection: async function() {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/lhg_users?select=count`, {
        method: 'HEAD',
        headers: this.headers
      });
      this.isOnline = resp.status !== 404 && resp.status < 500;
      this.updateStatusBadge();
      return this.isOnline;
    } catch(e) {
      this.isOnline = false;
      this.updateStatusBadge();
      return false;
    }
  },
  updateStatusBadge: function() {
    const dot = document.getElementById('db-status-dot');
    const txt = document.getElementById('db-status-text');
    if (!dot || !txt) return;
    if (this.isOnline) {
      dot.style.background = '#10B981';
      txt.textContent = 'Supabase Cloud (Terkoneksi)';
      txt.style.color = '#059669';
    } else {
      dot.style.background = '#F59E0B';
      txt.textContent = 'Mode Lokal (Supabase Belum Tabel)';
      txt.style.color = '#B45309';
    }
  },
  select: async function(table) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${table}?select=*`, {
        headers: this.headers
      });
      if (resp.ok) {
        this.isOnline = true;
        this.updateStatusBadge();
        return await resp.json();
      }
      return null;
    } catch(e) {
      return null;
    }
  },
  upsert: async function(table, data) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(data)
      });
      return resp.ok;
    } catch(e) {
      return false;
    }
  },
  delete: async function(table, filterCol, filterVal) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`, {
        method: 'DELETE',
        headers: this.headers
      });
      return resp.ok;
    } catch(e) {
      return false;
    }
  }
};

// ==============================================================================
// INDEXEDDB PHOTO & MEDIA STORE (UNLIMITED STORAGE QUOTA)
// ==============================================================================
const PhotoStore = {
  dbName: 'lhg_media_storage_v1',
  storeName: 'kegiatan_photos',
  _db: null,
  _cache: null,

  init: function() {
    return new Promise((resolve) => {
      if (this._db) return resolve(this._db);
      if (typeof window === 'undefined' || !window.indexedDB) {
        this._cache = this._fallbackGet();
        return resolve(null);
      }
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          this._db = e.target.result;
          this.getAll().then(() => resolve(this._db));
        };
        req.onerror = () => {
          this._cache = this._fallbackGet();
          resolve(null);
        };
      } catch(err) {
        this._cache = this._fallbackGet();
        resolve(null);
      }
    });
  },

  getAll: async function() {
    if (this._cache !== null) return this._cache;
    if (!this._db) {
      await this.init();
      if (!this._db) {
        this._cache = this._fallbackGet();
        return this._cache;
      }
    }
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            const legacy = this._fallbackGet();
            if (legacy && legacy.length > 0) {
              list = legacy;
              this.saveAll(list);
              try { localStorage.removeItem('lhg_foto'); } catch(e) {}
            }
          }
          this._cache = list;
          resolve(list);
        };
        req.onerror = () => {
          this._cache = this._fallbackGet();
          resolve(this._cache);
        };
      } catch(e) {
        this._cache = this._fallbackGet();
        resolve(this._cache);
      }
    });
  },

  saveAll: function(list) {
    this._cache = Array.isArray(list) ? list : [];
    if (this._db) {
      try {
        const tx = this._db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        this._cache.forEach(item => {
          try { store.put(item); } catch(err) {}
        });
      } catch(err) {
        console.warn('Gagal menyimpan foto ke IndexedDB:', err);
      }
    }
    // Remove heavy base64 strings from localStorage to prevent quota errors
    try {
      localStorage.removeItem('lhg_foto');
    } catch(e) {}
    // Background cloud sync to Supabase
    syncKeyToSupabase('lhg_foto', this._cache);
  },

  _fallbackGet: function() {
    try {
      return JSON.parse(localStorage.getItem('lhg_foto')) || [];
    } catch(e) {
      return [];
    }
  }
};

// HYBRID LOCAL & CLOUD DATABASE WRAPPER
const DB = {
  get: (key, def) => {
    def = def === undefined ? [] : def;
    if (key === 'lhg_foto') {
      if (PhotoStore._cache !== null) return PhotoStore._cache;
      return PhotoStore._fallbackGet();
    }
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v !== null ? v : def;
    } catch(e) {
      return def;
    }
  },
  set: (key, val) => {
    if (key === 'lhg_foto') {
      PhotoStore.saveAll(val);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch(e) {
      console.warn('LocalStorage Quota Warning on key:', key, e);
    }
    // Asynchronous background sync to Supabase Online
    syncKeyToSupabase(key, val);
  }
};

// INITIAL MOCK DATA SETUP (CLEAN EMPTY DATABASE FOR PRODUCTION)
function initData() {
  PhotoStore.init();
  // Always ensure dummy data is cleared if old caches exist
  if (!localStorage.getItem('lhg_init_clean_v3')) {
    localStorage.removeItem('lhg_init');
    localStorage.removeItem('lhg_init_modern_v1');
    localStorage.removeItem('lhg_init_clean_prod_v2');

    localStorage.setItem('lhg_anggota', JSON.stringify([]));
    localStorage.setItem('lhg_bantuan', JSON.stringify([]));
    localStorage.setItem('lhg_kegiatan', JSON.stringify([]));
    localStorage.setItem('lhg_surat_masuk', JSON.stringify([]));
    localStorage.setItem('lhg_surat_keluar', JSON.stringify([]));
    localStorage.setItem('lhg_foto', JSON.stringify([]));
    localStorage.setItem('lhg_arsip', JSON.stringify([]));
    localStorage.setItem('lhg_rencana_kegiatan', JSON.stringify([]));

    localStorage.setItem('lhg_init_clean_v3', '1');
  }

  if (!localStorage.getItem('lhg_arsip')) {
    localStorage.setItem('lhg_arsip', JSON.stringify([]));
  }

  if (!localStorage.getItem('lhg_rencana_kegiatan')) {
    localStorage.setItem('lhg_rencana_kegiatan', JSON.stringify([]));
  }

  initUsersData();
}

// ================= USER DATABASE & AUTHENTICATION =================
function getDeletedUsers() {
  try {
    const raw = localStorage.getItem('lhg_deleted_users');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch(e) {
    return [];
  }
}

function addDeletedUser(username) {
  if (!username) return;
  const list = getDeletedUsers();
  if (!list.includes(username)) {
    list.push(username);
    localStorage.setItem('lhg_deleted_users', JSON.stringify(list));
  }
}

function removeDeletedUser(username) {
  if (!username) return;
  const list = getDeletedUsers().filter(u => u !== username);
  localStorage.setItem('lhg_deleted_users', JSON.stringify(list));
}

function initUsersData() {
  const defaultSuperadmin = {
    username: '2172041908850002',
    password: '19081985',
    nama: 'KAMARIDA',
    role: 'Superadmin',
    status: 'Aktif',
    createdAt: '2024-01-01'
  };

  const isSetupDone = localStorage.getItem('lhg_users_setup_v3');
  const deletedUsers = getDeletedUsers();
  let users = DB.get('lhg_users', []);

  if (!isSetupDone) {
    // Hanya saat inisialisasi awal sekali jika data users benar-benar kosong
    if (!users || users.length === 0) {
      users = [
        defaultSuperadmin,
        {
          username: 'admin',
          password: 'admin123',
          nama: 'Admin Pelayanan LHG',
          role: 'Admin',
          status: 'Aktif',
          createdAt: '2024-02-01'
        },
        {
          username: 'petugas',
          password: 'petugas123',
          nama: 'Petugas Pendataan Lapangan',
          role: 'Petugas',
          status: 'Aktif',
          createdAt: '2024-03-01'
        }
      ];
    }
    localStorage.setItem('lhg_users_setup_v3', '1');
  }

  // Jangan pernah memunculkan akun yang sudah dihapus
  users = users.filter(u => !deletedUsers.includes(u.username));

  // Pastikan Superadmin utama selalu ada
  const idx = users.findIndex(u => u.username === '2172041908850002');
  if (idx === -1) {
    users.unshift(defaultSuperadmin);
  } else {
    users[idx].password = '19081985';
    users[idx].role = 'Superadmin';
    users[idx].status = 'Aktif';
  }

  localStorage.setItem('lhg_users', JSON.stringify(users));
}

function getAuthUser() {
  try {
    const raw = localStorage.getItem('lhg_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function initAuth() {
  initUsersData();
  const user = getAuthUser();
  const loginScreen = document.getElementById('login-screen');
  const appRoot = document.getElementById('app-root');

  if (!user) {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appRoot) appRoot.style.display = 'none';
  } else {
    if (loginScreen) loginScreen.style.display = 'none';
    if (appRoot) appRoot.style.display = 'flex';
    applyRoleUI(user);
    if (user.role === 'Petugas') {
      navigate('input-data-form');
    } else {
      navigate('dashboard');
    }
  }
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  const errBox = document.getElementById('login-error-alert');
  const errMsg = document.getElementById('login-error-msg');

  const u = uInput ? uInput.value.trim() : '';
  const p = pInput ? pInput.value.trim() : '';

  if (!u || !p) {
    if (errBox) {
      errBox.style.display = 'flex';
      errMsg.textContent = 'Harap isi username / NIK dan kata sandi!';
    }
    return;
  }

  // Cek apakah akun pernah dihapus dari sistem
  const deletedUsers = getDeletedUsers();
  if (deletedUsers.includes(u)) {
    if (errBox) {
      errBox.style.display = 'flex';
      errMsg.textContent = 'Akun ini telah dihapus dan tidak dapat mengakses aplikasi lagi!';
    }
    return;
  }

  const users = DB.get('lhg_users', []);
  const found = users.find(x => x.username === u && x.password === p);

  if (!found) {
    if (errBox) {
      errBox.style.display = 'flex';
      errMsg.textContent = 'Username / NIK atau kata sandi tidak valid!';
    }
    return;
  }

  if (found.status === 'Nonaktif') {
    if (errBox) {
      errBox.style.display = 'flex';
      errMsg.textContent = 'Akun ini berstatus Nonaktif. Silakan hubungi Superadmin!';
    }
    return;
  }

  if (errBox) errBox.style.display = 'none';
  localStorage.setItem('lhg_auth_user', JSON.stringify(found));
  showToast(`Selamat datang, ${found.nama}! Masuk sebagai ${found.role}.`, 'success');

  const loginScreen = document.getElementById('login-screen');
  const appRoot = document.getElementById('app-root');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appRoot) appRoot.style.display = 'flex';

  applyRoleUI(found);
  if (found.role === 'Petugas') {
    navigate('input-data-form');
  } else {
    navigate('dashboard');
  }
}

async function handleLogout() {
  const confirmed = await showModernConfirm({
    title: 'Keluar dari Sistem',
    message: 'Apakah Anda yakin ingin keluar dari sistem aplikasi?',
    subtext: 'Sesi akun Anda akan diakhiri dan Anda harus masuk kembali untuk melanjutkan.',
    confirmText: 'Ya, Keluar',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'logout'
  });
  if (!confirmed) return;
  localStorage.removeItem('lhg_auth_user');
  const loginScreen = document.getElementById('login-screen');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';

  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.reset();

  const errBox = document.getElementById('login-error-alert');
  if (errBox) errBox.style.display = 'none';

  showToast('Anda telah keluar dari aplikasi.', 'info');
}

function quickFillLogin(username, password) {
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  const errBox = document.getElementById('login-error-alert');
  if (uInput) uInput.value = username;
  if (pInput) pInput.value = password;
  if (errBox) errBox.style.display = 'none';
}

function toggleLoginPassword() {
  const pInput = document.getElementById('login-password');
  if (!pInput) return;
  pInput.type = pInput.type === 'password' ? 'text' : 'password';
}

function applyRoleUI(user) {
  if (!user) return;

  // Sidebar profile
  setText('sidebar-user-name', user.nama || user.username);
  setText('sidebar-user-role', user.role);
  setText('sidebar-user-avatar', getInitials(user.nama || user.username));

  // Topbar role badge
  setText('topbar-role-text', user.role);
  const topbarBadge = document.getElementById('topbar-role-badge');
  if (topbarBadge) {
    topbarBadge.className = 'user-role-pill ' + (user.role || 'petugas').toLowerCase();
  }

  // Filter sidebar menu items
  const userRole = (user.role || '').toLowerCase();
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    const allowed = btn.getAttribute('data-allowed-roles');
    if (!allowed) return;
    const allowedList = allowed.split(',').map(r => r.trim().toLowerCase());
    if (allowedList.includes(userRole)) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  });

  // Filter sidebar sections
  document.querySelectorAll('.nav-section-label').forEach(sec => {
    const sType = sec.getAttribute('data-nav-section');
    if (sType === 'arsip') {
      sec.style.display = userRole === 'petugas' ? 'none' : 'block';
    } else if (sType === 'pengaturan') {
      sec.style.display = userRole === 'superadmin' ? 'block' : 'none';
    } else {
      sec.style.display = 'block';
    }
  });

  // Adapt mobile bottom navigation based on role
  const bMainBtn = document.getElementById('bottom-nav-btn-main');
  const bMainIcon = document.getElementById('bottom-nav-icon-main');
  const bMainLbl = document.getElementById('bottom-nav-label-main');
  if (bMainBtn && bMainIcon && bMainLbl) {
    if (userRole === 'petugas') {
      bMainBtn.setAttribute('data-bottom-page', 'rencana-kegiatan');
      bMainBtn.setAttribute('onclick', "navigate('rencana-kegiatan')");
      bMainIcon.textContent = '📋';
      bMainLbl.textContent = 'Rencana';
    } else {
      bMainBtn.setAttribute('data-bottom-page', 'dashboard');
      bMainBtn.setAttribute('onclick', "navigate('dashboard')");
      bMainIcon.textContent = '📊';
      bMainLbl.textContent = 'Dashboard';
    }
  }
}

function hasPermission(role, page) {
  const permissions = {
    Superadmin: ['dashboard', 'input-data-form', 'input-data', 'bantuan', 'rencana-kegiatan', 'cetak-kta', 'form-pendaftaran', 'laporan-kegiatan', 'surat-menyurat', 'foto-kegiatan', 'arsip-berkas', 'manajemen-user'],
    Admin: ['dashboard', 'input-data-form', 'input-data', 'bantuan', 'rencana-kegiatan', 'cetak-kta', 'form-pendaftaran', 'laporan-kegiatan', 'surat-menyurat', 'foto-kegiatan', 'arsip-berkas'],
    Petugas: ['input-data-form', 'input-data', 'bantuan', 'rencana-kegiatan', 'cetak-kta', 'form-pendaftaran']
  };
  const list = permissions[role] || [];
  return list.includes(page);
}

// WHATSAPP HELPER FUNCTION (AUTOMATIC DIRECT LINK)
function openWhatsApp(phone) {
  if (!phone) {
    showToast('Nomor WhatsApp belum diisi!', 'warning');
    return;
  }
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (!clean) {
    showToast('Nomor WhatsApp tidak valid!', 'error');
    return;
  }
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  window.open('https://wa.me/' + clean, '_blank');
}

// SIDEBAR TOGGLING (DESKTOP COLLAPSE & MOBILE DRAWER)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('mobile-open');
    backdrop.classList.toggle('active');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// NAVIGATION HANDLER
function navigate(page) {
  const user = getAuthUser();
  if (!user) {
    initAuth();
    return;
  }

  // Permission Guard
  if (!hasPermission(user.role, page)) {
    showToast(`Akses ke menu ini dibatasi untuk peran ${user.role}!`, 'warning');
    const fallback = user.role === 'Petugas' ? 'input-data-form' : 'dashboard';
    if (page !== fallback) navigate(fallback);
    return;
  }

  // Update sidebar active buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === page);
  });

  // Update mobile bottom nav active buttons
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    const bPage = btn.getAttribute('data-bottom-page');
    if (bPage === page) {
      btn.classList.add('active');
    } else if (bPage === 'menu' && !['dashboard', 'input-data-form', 'input-data', 'bantuan', 'rencana-kegiatan'].includes(page)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Switch pages
  document.querySelectorAll('.page').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Close mobile sidebar if open
  if (window.innerWidth <= 900) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  // Smooth scroll to top when changing page on mobile
  const contentBody = document.querySelector('.content-body');
  if (contentBody) contentBody.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Update topbar headers
  const pageTitles = {
    'dashboard': ['Dashboard Ringkasan', 'Statistik dan data terpadu anak penyandang disabilitas Kota Tanjungpinang'],
    'input-data-form': ['Input Data Anak', 'Formulir input data calon anak disabilitas langsung ke database yayasan'],
    'input-data': ['Data Anak Disabilitas', 'Kelola pendaftaran lengkap anak, identitas KK, ragam disabilitas, dan kontak wali'],
    'bantuan': ['Catatan Penerimaan Bantuan Anak', 'Daftar semua bantuan yang telah diterima anak lengkap dengan tanggal penyerahan'],
    'rencana-kegiatan': ['Rencana Kegiatan & Program Kerja', 'Penyusunan agenda kerja, sasaran disabilitas, jadwal, dan estimasi anggaran yayasan'],
    'cetak-kta': ['Cetak Kartu Tanda Anggota', 'Penerbitan kartu identitas resmi binaan Lentera Hati Gurindam'],
    'form-pendaftaran': ['Surat Keterangan Hasil Pendaftaran', 'Pratinjau, unduh berkas PDF resmi format A4, dan cetak blanko fisik'],
    'laporan-kegiatan': ['Laporan Kegiatan', 'Dokumentasi pelaksanaan agenda kegiatan kemandirian dan terapi anak'],
    'surat-menyurat': ['Surat Menyurat', 'Arsip administrasi surat masuk dan surat keluar resmi organisasi'],
    'foto-kegiatan': ['Galeri Foto Kegiatan', 'Dokumentasi foto kegiatan dan interaksi anak binaan di lapangan'],
    'arsip-berkas': ['Arsip Berkas Yayasan', 'Pusat dokumen resmi, surat keputusan, legalitas, dan arsip berkas yayasan'],
    'manajemen-user': ['Manajemen User & Hak Akses', 'Kelola akun login aplikasi dengan hak peran Superadmin, Admin, dan Petugas']
  };

  const info = pageTitles[page] || ['Lentera Hati Gurindam', 'Aplikasi Pendataan Anak Disabilitas'];
  setText('topbar-page-title', info[0]);
  setText('topbar-page-desc', info[1]);

  if (page === 'dashboard') renderDashboard();
  if (page === 'input-data-form') initDirectInputPage();
  if (page === 'input-data') renderAnggotaTable();
  if (page === 'bantuan') renderBantuanPage();
  if (page === 'rencana-kegiatan') renderRencanaKegiatanPage();
  if (page === 'cetak-kta') renderCetakKTA();
  if (page === 'form-pendaftaran') renderFormPendaftaranPage();
  if (page === 'laporan-kegiatan') renderLaporan();
  if (page === 'surat-menyurat') renderSurat();
  if (page === 'foto-kegiatan') renderFoto();
  if (page === 'arsip-berkas') renderArsip();
  if (page === 'manajemen-user') renderManajemenUserTable();
}

// REALTIME CLOCK
function updateClock() {
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dName = days[now.getDay()];
  const dNum = String(now.getDate()).padStart(2, '0');
  const mName = months[now.getMonth()];
  const yNum = now.getFullYear();
  const timeStr = now.toTimeString().slice(0, 8);
  setText('header-clock', `${dName}, ${dNum} ${mName} ${yNum} - ${timeStr}`);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getInitials(name) {
  if (!name) return 'LH';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(d) {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

// DISABILITY BADGE CLASS HELPER
function getDisabilityBadgeClass(d) {
  const map = {
    'Tuna Rungu': 'badge-rungu',
    'Tuna Netra': 'badge-netra',
    'Tuna Grahita': 'badge-grahita',
    'Autis': 'badge-autis',
    'Down Syndrome': 'badge-down',
    'Disabilitas Berat': 'badge-berat',
    'Tuna Daksa Kursi Roda': 'badge-kursi-roda',
    'Tuna Daksa Tongkat': 'badge-tongkat',
    'Tuna Daksa Kaku': 'badge-kaku',
    'Tuna Daksa Tanpa Tangan': 'badge-tangan'
  };
  return map[d] || 'badge-default';
}

// ================= DASHBOARD RENDER =================
let chartInst = null;

function renderDashboard() {
  const anggota = DB.get('lhg_anggota');
  const kegiatan = DB.get('lhg_kegiatan');
  const sm = DB.get('lhg_surat_masuk');
  const sk = DB.get('lhg_surat_keluar');
  const aktif = anggota.filter(a => a.status === 'Aktif').length;

  setText('stat-total', anggota.length);
  setText('stat-aktif', aktif);
  setText('stat-kegiatan', kegiatan.length);
  setText('stat-surat', sm.length + sk.length);
  setText('nav-badge-anak', anggota.length);
  setText('bottom-badge-anak', anggota.length);
  const bList = DB.get('lhg_bantuan', []);
  setText('nav-badge-bantuan', bList.length);
  setText('bottom-badge-bantuan', bList.length);
  const rList = DB.get('lhg_rencana_kegiatan', []);
  setText('nav-badge-rencana', rList.length);

  // Recent 5 Children
  const actEl = document.getElementById('dashboard-activity');
  if (actEl) {
    if (anggota.length === 0) {
      actEl.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 6px;">👶</div>
          <p style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">Belum Ada Data Anak</p>
          <p style="font-size: 11.5px;">Gunakan menu "Input Data" untuk mendaftarkan anak binaan baru.</p>
        </div>
      `;
    } else {
      actEl.innerHTML = anggota.slice(0, 5).map(a => `
        <div class="recent-item">
          <div style="display: flex; align-items: center;">
            <div class="recent-avatar-circle">${getInitials(a.nama)}</div>
            <div class="recent-info">
              <div class="recent-name">${a.nama}</div>
              <div class="recent-meta">${a.kelurahan ? 'Kel. ' + a.kelurahan + ' • ' : ''}${a.disabilitas}</div>
            </div>
          </div>
          <button class="table-wa-link" onclick="viewAnggota('${a.id}')" title="Lihat Detail">
            👁️ Detail
          </button>
        </div>
      `).join('');
    }
  }

  renderChart();

  // 10 Disability Breakdown
  const types = {};
  anggota.forEach(a => { types[a.disabilitas] = (types[a.disabilitas] || 0) + 1; });
  const dbEl = document.getElementById('disability-breakdown');
  if (dbEl) {
    if (Object.keys(types).length === 0) {
      dbEl.innerHTML = `
        <div style="text-align: center; padding: 24px 16px; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 4px;">📊</div>
          <p style="font-size: 12px;">Distribusi ragam disabilitas akan muncul otomatis saat data diinput.</p>
        </div>
      `;
    } else {
      dbEl.innerHTML = Object.entries(types).map(([k, v]) => {
        const pct = Math.round((v / (anggota.length || 1)) * 100);
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; margin-bottom: 2px;">
              <span class="disability-pill ${getDisabilityBadgeClass(k)}">${k}</span>
              <span style="color: var(--primary); font-weight: 800;">${v} Anak (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderChart() {
  const ctx = document.getElementById('dashboardChart');
  if (!ctx) return;
  if (chartInst) { chartInst.destroy(); chartInst = null; }

  const anggota = DB.get('lhg_anggota', []);
  const totalCount = anggota.length;
  const aktifCount = anggota.filter(a => a.status === 'Aktif').length;

  chartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt'],
      datasets: [
        {
          label: 'Total Terdaftar',
          data: totalCount === 0 ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, totalCount, totalCount],
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#059669'
        },
        {
          label: 'Anak Aktif',
          data: totalCount === 0 ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, aktifCount, aktifCount],
          borderColor: '#3B82F6',
          backgroundColor: 'transparent',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#3B82F6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

// ================= DATA ANAK TABLE & FILTER =================
let editId = null;
let currentSearch = '';
let currentDisabilityFilter = '';

function filterByDisabilitas(val) {
  currentDisabilityFilter = val;
  renderAnggotaTable(currentSearch);
}

function renderAnggotaTable(search) {
  if (search !== undefined) currentSearch = search;
  const list = DB.get('lhg_anggota').filter(a => {
    const s = (currentSearch || '').toLowerCase();
    const matchSearch = !s ||
      a.nama.toLowerCase().includes(s) ||
      a.nik.toLowerCase().includes(s) ||
      (a.noKk && a.noKk.toLowerCase().includes(s)) ||
      (a.kelurahan && a.kelurahan.toLowerCase().includes(s)) ||
      a.disabilitas.toLowerCase().includes(s) ||
      (a.wali && a.wali.toLowerCase().includes(s));
    const matchDis = !currentDisabilityFilter || a.disabilitas === currentDisabilityFilter;
    return matchSearch && matchDis;
  });

  setText('table-total-count-text', `Total: ${list.length} Anak`);
  const tbody = document.getElementById('anggota-tbody');
  const cardList = document.getElementById('anggota-card-list');

  if (!list.length) {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #94A3B8;">Tidak ada data ditemukan</td></tr>';
    }
    if (cardList) {
      cardList.innerHTML = `
        <div class="mobile-empty-card">
          <div style="font-size: 38px; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 800; color: #1E293B; font-size: 14.5px;">Tidak Ada Data Anak</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 4px; line-height: 1.5;">Belum ada data anak disabilitas yang sesuai filter atau pencarian Anda.</div>
          <button type="button" class="btn-top-add" style="margin-top: 14px; width: 100%; justify-content: center;" onclick="openAddAnggota()">
            ➕ Tambah Data Anak Baru
          </button>
        </div>
      `;
    }
    return;
  }

  // Render tabel untuk layar desktop
  if (tbody) {
    tbody.innerHTML = list.map((a, i) => `
      <tr>
        <td style="text-align: center; font-weight: 700; color: #64748B;">${i + 1}</td>
        <td>
          <div style="font-weight: 800; color: #0F172A; font-size: 13px;">${a.nama}</div>
          ${a.kelurahan ? `<div style="font-size: 11px; color: #059669; font-weight: 600;">📍 Kel. ${a.kelurahan}</div>` : ''}
        </td>
        <td>
          <div class="id-badge-pill">
            <span class="id-tag">NIK</span>
            <span class="id-val">${a.nik}</span>
          </div>
          ${a.noKk ? `
            <div class="id-badge-pill" style="margin-top: 3px;">
              <span class="id-tag" style="background: #E0E7FF; color: #3730A3;">KK</span>
              <span class="id-val">${a.noKk}</span>
            </div>
          ` : ''}
        </td>
        <td style="text-align: center; font-weight: 600; color: #475569;">${a.umur || '12 Thn'}</td>
        <td style="text-align: center;">
          <span class="disability-pill ${getDisabilityBadgeClass(a.disabilitas)}">${a.disabilitas}</span>
          ${a.subDisabilitas ? `<div style="font-size: 9.5px; color: #64748B; margin-top: 2px;">${a.subDisabilitas}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 700; color: #1E293B;">${a.wali || '-'}</div>
          ${a.ibu ? `<div style="font-size: 10.5px; color: #64748B;">Ibu: <strong>${a.ibu}</strong></div>` : ''}
          <div style="margin-top: 4px;">
            ${(a.kontakWA || a.telWali) ? `
              <a href="javascript:void(0)" onclick="openWhatsApp('${a.kontakWA || a.telWali}')" class="table-wa-link" title="Buka WhatsApp">
                <svg width="12" height="12" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                ${a.kontakWA || a.telWali}
              </a>
            ` : '-'}
          </div>
        </td>
        <td style="text-align: center; font-weight: 700; color: #475569;">${a.kelas || '-'}</td>
        <td style="text-align: center;">
          <span class="${a.status === 'Aktif' ? 'badge-status-aktif' : 'badge-status-tidak-aktif'}">${a.status}</span>
        </td>
        <td style="text-align: center;">
          <div class="action-buttons-group">
            <button class="btn-action-icon" onclick="viewAnggota('${a.id}')" title="Detail Lengkap">👁️</button>
            <button class="btn-action-icon" onclick="openEditAnggota('${a.id}')" title="Edit Data">✏️</button>
            <button class="btn-action-icon" onclick="cetakKTAFor('${a.id}')" title="Cetak ID Card / KTA">💳</button>
            <button class="btn-action-icon" onclick="openSuratFor('${a.id}')" title="Surat Keterangan Pendaftaran (PDF)">📄</button>
            <button class="btn-action-icon danger" onclick="deleteAnggota('${a.id}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Render tampilan kartu (Card View) untuk layar ponsel / mobile
  if (cardList) {
    cardList.innerHTML = list.map((a) => {
      const waNum = a.kontakWA || a.telWali || '';
      return `
        <div class="data-record-card" onclick="viewAnggota('${a.id}')" title="Ketuk untuk melihat rincian data">
          <div class="d-card-header">
            <div class="d-card-avatar-wrap">
              ${a.foto ? `
                <img src="${a.foto}" class="d-card-photo" alt="${a.nama}">
              ` : `
                <div class="d-card-avatar">${getInitials(a.nama)}</div>
              `}
            </div>
            <div class="d-card-main-info">
              <div class="d-card-title-row">
                <h4 class="d-card-name">${a.nama}</h4>
                <span class="${a.status === 'Aktif' ? 'badge-status-aktif' : 'badge-status-tidak-aktif'}">${a.status}</span>
              </div>
              <div class="d-card-sub-row">
                ${a.kelurahan ? `<span class="d-card-loc">📍 Kel. ${a.kelurahan}</span>` : ''}
                <span class="d-card-age">🎂 ${a.umur || '12 Thn'}</span>
                ${a.kelas ? `<span style="font-weight:600; color:#475569;">• 🏫 ${a.kelas}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="d-card-tags">
            <span class="disability-pill ${getDisabilityBadgeClass(a.disabilitas)}">${a.disabilitas}</span>
            <span class="d-card-nik-tag">🆔 ${a.nik}</span>
            ${a.noKk ? `<span class="d-card-tag-pill">KK: ${a.noKk}</span>` : ''}
          </div>

          <div class="d-card-footer">
            <div class="d-card-parent-info">
              <span>Ortu: <strong>${a.wali || a.ibu || '-'}</strong></span>
              ${waNum ? `
                <button type="button" class="d-card-btn-wa" onclick="event.stopPropagation(); openWhatsApp('${waNum}')" title="Hubungi via WhatsApp">
                  💬 WA
                </button>
              ` : ''}
            </div>
            <div class="d-card-actions" onclick="event.stopPropagation();">
              <button type="button" class="btn-action-icon" onclick="viewAnggota('${a.id}')" title="Detail Lengkap">👁️</button>
              <button type="button" class="btn-action-icon" onclick="openEditAnggota('${a.id}')" title="Edit Data">✏️</button>
              <button type="button" class="btn-action-icon" onclick="cetakKTAFor('${a.id}')" title="Cetak KTA">💳</button>
              <button type="button" class="btn-action-icon danger" onclick="deleteAnggota('${a.id}')" title="Hapus Data">🗑️</button>
            </div>
          </div>

          <div class="d-card-tap-cue">
            <span>👆 Ketuk kartu untuk detail data & cetak berkas</span>
            <span class="d-card-tap-arrow">›</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ================= UPLOAD FOTO & PREVIEW HELPERS =================
let currentDirectPhotoBase64 = null;
let currentModalPhotoBase64 = null;

function handleDirectPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG/PNG)!', 'error');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast('Ukuran foto terlalu besar! Maksimal 3MB.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    // Compress/resize image before saving to optimize localStorage and Supabase sync
    compressImage(e.target.result, 400, 500, 0.85, function(compressedBase64) {
      currentDirectPhotoBase64 = compressedBase64;
      updateDirectPhotoUI(compressedBase64);
      showToast('Pas foto berhasil dimuat! Siap dicetak di ID Card.', 'success');
    });
  };
  reader.readAsDataURL(file);
}

function updateDirectPhotoUI(base64) {
  const imgEl = document.getElementById('direct-photo-img');
  const iconEl = document.getElementById('direct-photo-placeholder-icon');
  const textEl = document.getElementById('direct-photo-placeholder-text');
  const btnRemove = document.getElementById('btn-direct-remove-photo');

  if (base64) {
    if (imgEl) { imgEl.src = base64; imgEl.style.display = 'block'; }
    if (iconEl) iconEl.style.display = 'none';
    if (textEl) textEl.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-block';
  } else {
    if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
    if (iconEl) iconEl.style.display = 'block';
    if (textEl) textEl.style.display = 'block';
    if (btnRemove) btnRemove.style.display = 'none';
  }
}

function removeDirectPhoto() {
  currentDirectPhotoBase64 = null;
  const inputEl = document.getElementById('direct-foto');
  if (inputEl) inputEl.value = '';
  updateDirectPhotoUI(null);
  showToast('Pas foto dihapus dari form.', 'info');
}

function handleModalPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG/PNG)!', 'error');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast('Ukuran foto terlalu besar! Maksimal 3MB.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    compressImage(e.target.result, 400, 500, 0.85, function(compressedBase64) {
      currentModalPhotoBase64 = compressedBase64;
      updateModalPhotoUI(compressedBase64);
      showToast('Pas foto berhasil dipilih!', 'success');
    });
  };
  reader.readAsDataURL(file);
}

function updateModalPhotoUI(base64) {
  const imgEl = document.getElementById('modal-photo-img');
  const iconEl = document.getElementById('modal-photo-placeholder-icon');
  const textEl = document.getElementById('modal-photo-placeholder-text');
  const btnRemove = document.getElementById('btn-modal-remove-photo');

  if (base64) {
    if (imgEl) { imgEl.src = base64; imgEl.style.display = 'block'; }
    if (iconEl) iconEl.style.display = 'none';
    if (textEl) textEl.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-block';
  } else {
    if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
    if (iconEl) iconEl.style.display = 'block';
    if (textEl) textEl.style.display = 'block';
    if (btnRemove) btnRemove.style.display = 'none';
  }
}

function removeModalPhoto() {
  currentModalPhotoBase64 = null;
  const inputEl = document.getElementById('modal-foto-anggota');
  if (inputEl) inputEl.value = '';
  updateModalPhotoUI(null);
  showToast('Pas foto dihapus dari form.', 'info');
}

// Utility to compress images so database sync is ultra-fast
function compressImage(base64, maxW, maxH, quality, callback) {
  const img = new Image();
  img.onload = function() {
    let w = img.width;
    let h = img.height;
    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = function() {
    callback(base64);
  };
  img.src = base64;
}

// ================= DIRECT INPUT FORM (MENU INPUT DATA) =================
function initDirectInputPage() {
  // Reset form
  resetDirectInputForm();
}

function resetDirectInputForm() {
  const f = document.getElementById('form-direct-input-anak');
  if (f) f.reset();
  removeDirectPhoto();
}

function handleDirectDisabilityChange(val) {
  const subEl = document.getElementById('direct-subDisabilitas');
  if (!subEl) return;
  const presets = {
    'Tuna Rungu': 'Gangguan Pendengaran & Wicara',
    'Tuna Netra': 'Hambatan Penglihatan / Low Vision',
    'Tuna Grahita': 'Hambatan Perkembangan Intelektual',
    'Autis': 'Autisme Spectrum Disorder (ASD)',
    'Down Syndrome': 'Kelainan Genetik Trisomi 21',
    'Disabilitas Berat': 'Hambatan Ganda / Kebutuhan Bantuan Khusus',
    'Tuna Daksa Kursi Roda': 'Mobilitas Menggunakan Kursi Roda',
    'Tuna Daksa Tongkat': 'Mobilitas Menggunakan Tongkat / Kruk',
    'Tuna Daksa Kaku': 'Cerebral Palsy / Kekakuan Otot',
    'Tuna Daksa Tanpa Tangan': 'Hambatan Fisik Anggota Gerak Atas'
  };
  if (presets[val] && (!subEl.value || Object.values(presets).includes(subEl.value))) {
    subEl.value = presets[val];
  }
}

function saveDirectInputAnak(event) {
  if (event) event.preventDefault();
  const nama = document.getElementById('direct-nama').value.trim();
  const nik = document.getElementById('direct-nik').value.trim();
  const noKk = (document.getElementById('direct-noKk') ? document.getElementById('direct-noKk').value.trim() : '');
  const ttl = document.getElementById('direct-ttl').value.trim();
  const jk = document.getElementById('direct-jk').value;
  const kontakWA = document.getElementById('direct-kontakWA').value.trim();
  const disabilitas = document.getElementById('direct-disabilitas').value;
  const subDisabilitas = (document.getElementById('direct-subDisabilitas') ? document.getElementById('direct-subDisabilitas').value.trim() : '');
  const status = (document.getElementById('direct-status') ? document.getElementById('direct-status').value : 'Aktif');
  const sekolah = (document.getElementById('direct-sekolah') ? document.getElementById('direct-sekolah').value.trim() : '');
  const kelas = (document.getElementById('direct-kelas') ? document.getElementById('direct-kelas').value.trim() : '1');
  const alamat = (document.getElementById('direct-alamat') ? document.getElementById('direct-alamat').value.trim() : '');
  const kelurahan = (document.getElementById('direct-kelurahan') ? document.getElementById('direct-kelurahan').value.trim() : '');
  const wali = (document.getElementById('direct-wali') ? document.getElementById('direct-wali').value.trim() : '');
  const ibu = (document.getElementById('direct-ibu') ? document.getElementById('direct-ibu').value.trim() : '');
  const hubWali = (document.getElementById('direct-hubWali') ? document.getElementById('direct-hubWali').value : 'Orang Tua');

  if (!nama || !nik || !disabilitas) {
    showToast('Harap isi field Nama, NIK, dan Ragam Disabilitas!', 'error');
    return;
  }

  const anggota = DB.get('lhg_anggota');
  const no = 'LHG-' + String(anggota.length + 1).padStart(3, '0');
  const newRecord = {
    id: no,
    noAnggota: no,
    nama: nama.toUpperCase(),
    nik: nik,
    noKk: noKk,
    ttl: ttl,
    jk: jk,
    kontakWA: kontakWA,
    disabilitas: disabilitas,
    subDisabilitas: subDisabilitas,
    status: status,
    sekolah: sekolah,
    kelas: kelas || '101',
    alamat: alamat,
    kelurahan: kelurahan,
    wali: wali,
    ibu: ibu,
    hubWali: hubWali,
    telWali: kontakWA,
    umur: '12 Thn',
    tglDaftar: new Date().toISOString().split('T')[0],
    foto: currentDirectPhotoBase64 || null
  };

  anggota.unshift(newRecord);
  DB.set('lhg_anggota', anggota);
  resetDirectInputForm();

  renderAnggotaTable();
  renderDashboard();
  if (typeof renderCetakKTA === 'function') renderCetakKTA();
  if (typeof renderFormPendaftaranPage === 'function') renderFormPendaftaranPage(no);

  showToast(`Data anak "${newRecord.nama}" berhasil disimpan & foto siap dicetak di ID Card!`, 'success');
  
  // Arahkan user langsung ke halaman Cetak KTA atau Data Anak
  setTimeout(() => {
    cetakKTAFor(no);
  }, 700);
}

// ================= MODAL TAMBAH & EDIT ANGGOTA =================
function openAddAnggota() {
  editId = null;
  setText('modal-anggota-title', 'Tambah Data Anak Disabilitas');
  const f = document.getElementById('form-anggota');
  if (f) f.reset();
  currentModalPhotoBase64 = null;
  updateModalPhotoUI(null);
  document.getElementById('modal-anggota').classList.add('open');
}

function openEditAnggota(id) {
  editId = id;
  const a = DB.get('lhg_anggota').find(x => x.id === id);
  if (!a) return;
  setText('modal-anggota-title', 'Edit Data Anak');
  const f = document.getElementById('form-anggota');
  ['nama', 'nik', 'noKk', 'ttl', 'jk', 'kontakWA', 'alamat', 'kelurahan', 'disabilitas', 'subDisabilitas', 'wali', 'ibu', 'hubWali', 'telWali', 'sekolah', 'kelas', 'status'].forEach(k => {
    if (f[k]) f[k].value = a[k] || '';
  });

  // Load existing photo
  currentModalPhotoBase64 = a.foto || null;
  updateModalPhotoUI(currentModalPhotoBase64);

  document.getElementById('modal-anggota').classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.classList.remove('modal-open');
  }
  if (id === 'modal-view-arsip' && typeof activeArsipBlobUrl !== 'undefined' && activeArsipBlobUrl) {
    URL.revokeObjectURL(activeArsipBlobUrl);
    activeArsipBlobUrl = null;
  }
}

function saveAnggota() {
  const f = document.getElementById('form-anggota');
  if (!f.nama.value || !f.nik.value || !f.disabilitas.value) {
    showToast('Harap isi field nama, NIK, dan jenis disabilitas!', 'error');
    return;
  }

  const anggota = DB.get('lhg_anggota');
  const fd = {
    nama: f.nama.value.toUpperCase(),
    nik: f.nik.value,
    noKk: f.noKk ? f.noKk.value : '',
    ttl: f.ttl.value,
    jk: f.jk.value,
    kontakWA: f.kontakWA ? f.kontakWA.value : (f.telWali ? f.telWali.value : ''),
    alamat: f.alamat.value,
    kelurahan: f.kelurahan ? f.kelurahan.value : '',
    disabilitas: f.disabilitas.value,
    subDisabilitas: f.subDisabilitas.value,
    wali: f.wali.value,
    ibu: f.ibu ? f.ibu.value : '',
    hubWali: f.hubWali.value,
    telWali: f.telWali ? f.telWali.value : (f.kontakWA ? f.kontakWA.value : ''),
    sekolah: f.sekolah.value,
    kelas: f.kelas.value || '101',
    status: f.status.value,
    umur: '12 Thn',
    foto: currentModalPhotoBase64 || null
  };

  if (editId) {
    const idx = anggota.findIndex(a => a.id === editId);
    if (idx > -1) {
      // Retain previous photo if none selected in modal
      if (!fd.foto && anggota[idx].foto && currentModalPhotoBase64 !== null) {
        fd.foto = anggota[idx].foto;
      }
      Object.assign(anggota[idx], fd);
    }
    showToast('Data anak berhasil diperbarui!');
  } else {
    const no = 'LHG-' + String(anggota.length + 1).padStart(3, '0');
    anggota.unshift({ ...fd, id: no, noAnggota: no, tglDaftar: new Date().toISOString().split('T')[0] });
    showToast('Data anak baru berhasil ditambahkan!');
  }

  DB.set('lhg_anggota', anggota);
  closeModal('modal-anggota');
  renderAnggotaTable();
  renderDashboard();
  if (typeof renderCetakKTA === 'function') renderCetakKTA();
  if (typeof renderFormPendaftaranPage === 'function') {
    renderFormPendaftaranPage(editId || anggota[0].id);
  }
}

function viewAnggota(id) {
  const a = DB.get('lhg_anggota').find(x => x.id === id);
  if (!a) return;

  const waNum = a.kontakWA || a.telWali || '';
  const rows = [
    ['Nomor NIK', a.nik],
    ['Nomor Kartu Keluarga (KK)', a.noKk || '-'],
    ['Tempat, Tanggal Lahir', a.ttl],
    ['Jenis Kelamin', a.jk === 'L' ? 'Laki-laki' : 'Perempuan'],
    ['Alamat Lengkap', a.alamat || '-'],
    ['Kelurahan', a.kelurahan || '-'],
    ['Ragam Disabilitas', `${a.disabilitas} - ${a.subDisabilitas || '-'}`],
    ['Nama Orang Tua (Ayah)', a.wali || '-'],
    ['Nama Orang Tua (Ibu)', a.ibu || '-'],
    ['Hubungan Keluarga', a.hubWali || 'Orang Tua'],
    ['Kontak WhatsApp', waNum ? `<a href="javascript:void(0)" onclick="openWhatsApp('${waNum}')" class="wa-click-badge">💬 ${waNum} (Chat WA)</a>` : '-'],
    ['Sekolah / Kelas', `${a.sekolah || '-'} / ${a.kelas || '-'}`],
    ['Status Keaktifan', a.status],
    ['Tanggal Terdaftar', formatDate(a.tglDaftar)]
  ];

  document.getElementById('view-content').innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #E2E8F0;">
      ${a.foto ? `
        <img src="${a.foto}" alt="${a.nama}" style="width: 52px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #059669; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
      ` : `
        <div class="recent-avatar-circle" style="width: 48px; height: 48px; font-size: 16px; background: #ECFDF5; color: #059669; border: 2px solid #A7F3D0;">
          ${getInitials(a.nama)}
        </div>
      `}
      <div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0F172A; text-transform: uppercase;">${a.nama}</h3>
        <div style="font-size: 12px; color: #059669; font-weight: 700;">Nomor KTA: ${a.noAnggota || a.id}</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
      ${rows.map(([k, v]) => `
        <div style="background: #F8FAFC; padding: 9px 12px; border-radius: 8px; border: 1px solid #E2E8F0;">
          <div style="font-size: 10px; color: #64748B; font-weight: 700;">${k}</div>
          <div style="font-size: 12.5px; font-weight: 700; color: #1E293B; margin-top: 2px;">${v || '-'}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Aktifkan tombol aksi di footer modal
  const btnKta = document.getElementById('modal-view-btn-kta');
  const btnSurat = document.getElementById('modal-view-btn-surat');
  const btnEdit = document.getElementById('modal-view-btn-edit');
  if (btnKta) {
    btnKta.style.display = 'inline-flex';
    btnKta.onclick = () => { closeModal('modal-view'); cetakKTAFor(a.id); };
  }
  if (btnSurat) {
    btnSurat.style.display = 'inline-flex';
    btnSurat.onclick = () => { closeModal('modal-view'); openSuratFor(a.id); };
  }
  if (btnEdit) {
    btnEdit.style.display = 'inline-flex';
    btnEdit.onclick = () => { closeModal('modal-view'); openEditAnggota(a.id); };
  }

  document.getElementById('modal-view').classList.add('open');
}

async function deleteAnggota(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Data Anak',
    message: 'Apakah Anda yakin ingin menghapus data anak ini?',
    subtext: 'Data yang telah dihapus tidak dapat dipulihkan kembali.',
    confirmText: 'Ya, Hapus Data',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  const list = DB.get('lhg_anggota').filter(a => a.id !== id);
  localStorage.setItem('lhg_anggota', JSON.stringify(list));
  try {
    await SupabaseAPI.delete('lhg_anggota', 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus anggota dari cloud:', e);
  }
  renderAnggotaTable();
  renderDashboard();
  if (typeof renderCetakKTA === 'function') renderCetakKTA();
  if (typeof renderFormPendaftaranPage === 'function') renderFormPendaftaranPage();
  showToast('Data berhasil dihapus', 'warning');
}

// ================= CETAK ID CARD RESMI LHG =================
function renderCetakKTA() {
  const sel = document.getElementById('kta-select');
  if (!sel) return;
  const anggota = DB.get('lhg_anggota');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- Pilih Anggota Anak --</option>' +
    anggota.map(a => `<option value="${a.id}">${a.nama} (${a.nik}) - ${a.disabilitas}</option>`).join('');
  
  if (currentVal && anggota.some(a => a.id === currentVal)) {
    sel.value = currentVal;
    previewKTA();
  } else if (anggota.length > 0 && !sel.dataset.initialized) {
    sel.dataset.initialized = '1';
    sel.value = anggota[0].id;
    previewKTA();
  }
}

function cetakKTAFor(id) {
  navigate('cetak-kta');
  const sel = document.getElementById('kta-select');
  if (sel) {
    sel.value = id;
    previewKTA();
  }
}

function previewKTA() {
  const sel = document.getElementById('kta-select');
  const id = sel ? sel.value : null;
  const container = document.getElementById('kta-preview-container');
  if (!container) return;

  if (!id) {
    container.innerHTML = '<div class="empty-hint">Pilih data anak di atas untuk menampilkan pratinjau kartu tanda anggota.</div>';
    return;
  }
  const a = DB.get('lhg_anggota').find(x => x.id === id);
  if (!a) return;

  const rawAlamat = a.kelurahan ? (a.alamat ? a.alamat + ', ' + a.kelurahan : a.kelurahan) : (a.alamat || 'Tanjungpinang');
  const displayAlamat = rawAlamat.length > 32 ? rawAlamat.substring(0, 30) + '...' : rawAlamat;
  const noReg = a.noAnggota || a.id;
  const tglDaftar = formatDate(a.tglDaftar);

  container.innerHTML = `
    <div class="idcard-layout-flex">
      <!-- MOCKUP ID CARD -->
      <div class="idcard-render-wrapper">
        <div class="idcard-mockup" id="idcard-mockup">
          <img src="img/idcard-template.jpg" class="idcard-bg-img" alt="Template ID Card LHG">
          
          <div class="idcard-photo-box" id="preview-photo-box">
            ${a.foto ? `<img src="${a.foto}" class="idcard-photo-img" alt="${a.nama}">` : `
              <div class="idcard-photo-placeholder">
                <span class="idcard-avatar-emoji">${a.jk === 'L' ? '👦' : '👧'}</span>
                <span class="idcard-avatar-text">PAS FOTO</span>
              </div>
            `}
          </div>

          <div class="idcard-val idcard-val-nama" title="${a.nama}">${a.nama}</div>
          <div class="idcard-val idcard-val-alamat" title="${rawAlamat}">${displayAlamat}</div>
          <div class="idcard-val idcard-val-reg">${noReg}</div>
          <div class="idcard-val idcard-val-tgl">${tglDaftar}</div>
        </div>
      </div>

      <!-- KONTROL & AKSI ID CARD -->
      <div class="idcard-controls-panel">
        <div class="idcard-info-badge">
          <span class="badge-status-aktif" style="display:inline-block; margin-bottom:8px;">✅ Status: ${a.status}</span>
          <h4 style="font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 4px;">${a.nama}</h4>
          <div style="font-size: 12px; color: #64748B; margin-bottom: 6px;">
            NIK: <strong>${a.nik}</strong> • No. Reg: <strong>${noReg}</strong>
          </div>
          <div style="font-size: 12px; color: #059669; font-weight: 700;">
            🎗️ ${a.disabilitas} ${a.subDisabilitas ? '(' + a.subDisabilitas + ')' : ''}
          </div>
        </div>

        <div class="idcard-photo-upload-section">
          <label class="lbl" style="margin-bottom: 6px;">Pas Foto Anak (Opsional):</label>
          <input type="file" id="input-kta-foto" accept="image/*" style="display:none;" onchange="handleFotoKTAUpload(event, '${a.id}')">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-sec" onclick="document.getElementById('input-kta-foto').click()">
              <span>📷</span> ${a.foto ? 'Ganti Pas Foto' : 'Unggah Pas Foto'}
            </button>
            ${a.foto ? `<button type="button" class="btn-sec" style="color: #DC2626;" onclick="removeFotoKTA('${a.id}')">Hapus Foto</button>` : ''}
          </div>
          <p style="font-size: 11px; color: #94A3B8; margin-top: 6px;">
            Format JPG/PNG. Foto akan otomatis presisi di dalam bingkai ID Card.
          </p>
        </div>

        <div class="idcard-action-btns">
          <button class="btn-top-add btn-lg" onclick="printKTA('${a.id}')" style="width: 100%; justify-content: center; padding: 11px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
            <span>Cetak ID Card Siap Pakai</span>
          </button>
          <button class="btn-sec btn-lg" onclick="downloadKTAImage('${a.id}')" style="width: 100%; justify-content: center; padding: 10px;">
            <span>💾</span> Unduh ID Card (JPG HD 300 DPI)
          </button>
        </div>

        <div style="background: #F8FAFC; border-radius: 8px; padding: 12px; font-size: 11.5px; color: #475569; line-height: 1.5; border-left: 3.5px solid #059669; border: 1px solid var(--border-color); border-left: 3.5px solid #059669;">
          <strong>💡 Format ID Card Resmi:</strong><br>
          Ukuran rasio kartu telah disesuaikan dengan template resmi Yayasan Lentera Hati Gurindam. Siap dicetak langsung pada kertas foto atau kartu PVC standar ID Card.
        </div>
      </div>
    </div>
  `;
}

function handleFotoKTAUpload(event, id) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG/PNG)!', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const anggota = DB.get('lhg_anggota');
    const idx = anggota.findIndex(x => x.id === id);
    if (idx > -1) {
      anggota[idx].foto = base64;
      DB.set('lhg_anggota', anggota);
      showToast('Pas foto berhasil dipasang pada ID Card!');
      previewKTA();
    }
  };
  reader.readAsDataURL(file);
}

function removeFotoKTA(id) {
  const anggota = DB.get('lhg_anggota');
  const idx = anggota.findIndex(x => x.id === id);
  if (idx > -1) {
    delete anggota[idx].foto;
    DB.set('lhg_anggota', anggota);
    showToast('Pas foto dihapus, kembali ke avatar ilustrasi.');
    previewKTA();
  }
}

function generateKTACanvas(id, callback) {
  const a = DB.get('lhg_anggota').find(x => x.id === id);
  if (!a) return;

  const canvas = document.createElement('canvas');
  canvas.width = 682;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const bgImg = new Image();
  bgImg.crossOrigin = 'anonymous';
  bgImg.onload = function() {
    // 1. Draw template
    ctx.drawImage(bgImg, 0, 0, 682, 1024);

    const finishCanvas = () => {
      // 3. Draw Data Texts (Rata Kiri, Pas di Tengah Vertikal)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const dataStartX = 328; // Tepat di sebelah kanan titik dua yang sudah rata

      // Nama
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 19px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillText(a.nama.toUpperCase(), dataStartX, 661);

      // Alamat
      const rawAlamat = a.kelurahan ? (a.alamat ? a.alamat + ', ' + a.kelurahan : a.kelurahan) : (a.alamat || 'Tanjungpinang');
      ctx.font = 'bold 16px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#1E293B';
      const displayAlamat = rawAlamat.length > 32 ? rawAlamat.substring(0, 30) + '...' : rawAlamat;
      ctx.fillText(displayAlamat, dataStartX, 721);

      // No. Registrasi
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 20px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillText(a.noAnggota || a.id, dataStartX, 781);

      // Tanggal Terdaftar
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 16.5px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillText(formatDate(a.tglDaftar), dataStartX, 841);

      callback(canvas);
    };

    // 2. Draw Photo
    if (a.foto) {
      const pImg = new Image();
      pImg.crossOrigin = 'anonymous';
      pImg.onload = function() {
        ctx.save();
        roundRect(ctx, 234, 361, 214, 254, 16);
        ctx.clip();
        drawImageCover(ctx, pImg, 234, 361, 214, 254);
        ctx.restore();
        finishCanvas();
      };
      pImg.onerror = function() {
        drawFallbackAvatar();
        finishCanvas();
      };
      pImg.src = a.foto;
    } else {
      drawFallbackAvatar();
      finishCanvas();
    }

    function drawFallbackAvatar() {
      ctx.save();
      roundRect(ctx, 234, 361, 214, 254, 16);
      ctx.clip();
      ctx.fillStyle = '#F0F6FF';
      ctx.fillRect(234, 361, 214, 254);
      ctx.font = '72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.jk === 'L' ? '👦' : '👧', 341, 470);
      ctx.font = 'bold 14px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('PAS FOTO', 341, 545);
      ctx.restore();
    }
  };
  bgImg.src = 'img/idcard-template.jpg';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sWidth, sHeight, sx, sy;
  if (imgRatio > targetRatio) {
    sHeight = img.height;
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = img.width;
    sHeight = img.width / targetRatio;
    sx = 0;
    sy = (img.height - sHeight) / 2;
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function downloadKTAImage(id) {
  showToast('Menyiapkan file ID Card resolusi tinggi...');
  generateKTACanvas(id, function(canvas) {
    const a = DB.get('lhg_anggota').find(x => x.id === id);
    const link = document.createElement('a');
    link.download = `ID_Card_LHG_${a.noAnggota || a.id}_${a.nama.replace(/\s+/g, '_')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    showToast('ID Card berhasil diunduh (Format JPG HD)!');
  });
}

function printKTA(id) {
  if (!id) {
    const sel = document.getElementById('kta-select');
    id = sel ? sel.value : null;
  }
  if (!id) {
    showToast('Silakan pilih anggota terlebih dahulu!', 'warning');
    return;
  }
  showToast('Membuka dialog cetak ID Card...');
  generateKTACanvas(id, function(canvas) {
    const a = DB.get('lhg_anggota').find(x => x.id === id);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak ID Card - ${a.nama}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #F8FAFC;
          }
          .card-wrapper {
            text-align: center;
          }
          .idcard-img {
            width: 58mm;
            height: 87mm;
            border-radius: 3mm;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            display: block;
            margin: 0 auto;
          }
          .btn-print-box {
            margin-top: 20px;
          }
          .btn-print {
            background: #059669;
            color: #fff;
            border: none;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
          }
          @media print {
            body { background: transparent; }
            .btn-print-box { display: none; }
            .idcard-img { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="card-wrapper">
          <img src="${dataUrl}" class="idcard-img" alt="ID Card ${a.nama}">
          <div class="btn-print-box">
            <button class="btn-print" onclick="window.print()">🖨️ Cetak Kartu Sekarang</button>
            <p style="margin-top: 8px; font-size: 12px; color: #64748B;">Ukuran kartu sudah dipresisikan sesuai standar ID Card (58 x 87 mm).</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  });
}

// ================= SURAT KETERANGAN HASIL PENDAFTARAN (PDF A4) =================
function formatDateIndoFull(dStr) {
  if (!dStr) {
    const now = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const yr = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (m >= 0 && m < 12) {
      return `${d} ${months[m]} ${yr}`;
    }
  }
  return dStr;
}

function renderFormPendaftaranPage(selectedId) {
  const sel = document.getElementById('pdf-anggota-select');
  if (!sel) return;
  const anggota = DB.get('lhg_anggota');
  if (!anggota || anggota.length === 0) {
    sel.innerHTML = '<option value="">-- Belum ada data anak --</option>';
    const container = document.getElementById('pdf-preview-container');
    if (container) {
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: #475569; font-size: 14px;">Belum ada data pendaftar yang tersimpan di sistem. Silakan input data anak terlebih dahulu.</div>';
    }
    return;
  }

  const prevVal = selectedId || sel.value;
  sel.innerHTML = anggota.map(a => `<option value="${a.id}">${a.nama} (${a.noAnggota || a.id}) - ${a.disabilitas || 'Disabilitas'}</option>`).join('');

  if (prevVal && anggota.some(a => a.id === prevVal)) {
    sel.value = prevVal;
  } else {
    sel.value = anggota[0].id;
  }

  previewSuratPendaftaran();
}

function openSuratFor(id) {
  navigate('form-pendaftaran');
  const sel = document.getElementById('pdf-anggota-select');
  if (sel) {
    sel.value = id;
    previewSuratPendaftaran();
  }
}

function buildSuratPendaftaranHTML(a) {
  const tanggalSurat = formatDateIndoFull(a.tglDaftar);
  const alamatLengkap = (a.alamat || '-') + (a.kelurahan ? ', Kelurahan ' + a.kelurahan : '');
  const kontak = a.kontakWA || a.telWali || '-';
  const disabilitasText = `${a.disabilitas || '-'}${a.subDisabilitas ? ' (' + a.subDisabilitas + ')' : ''}`;

  return `
    <div class="a4-paper" id="surat-a4-document">
      <!-- KOP SURAT YAYASAN -->
      <div class="kop-surat">
        <div class="kop-logo-box">
          <img src="img/logo.png" alt="Logo LHG" class="kop-logo-img">
          <div class="kop-sublogo">PROVINSI KEPULAUAN RIAU</div>
        </div>
        <div class="kop-org-name">YAYASAN LENTERA HATI GURINDAM</div>
        <div class="kop-org-prov">PROVINSI KEPULAUAN RIAU</div>
        <div class="kop-divider-double"></div>
      </div>

      <!-- JUDUL SURAT -->
      <div class="surat-doc-title">SURAT KETERANGAN HASIL PENDAFTARAN</div>

      <!-- PARAGRAF PEMBUKA -->
      <p class="surat-paragraph">
        Dengan ini menerangkan bahwa calon peserta/pendaftar di bawah ini telah menyelesaikan proses administrasi dan <strong>DINYATAKAN BERHASIL TERDAFTAR</strong> pada Yayasan Lentera Hati Gurindam:
      </p>

      <!-- TABEL DATA LENGKAP -->
      <table class="surat-data-table">
        <tbody>
          <tr>
            <td class="surat-col-label">Nomor Registrasi</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val"><strong>${a.noAnggota || a.id}</strong></td>
          </tr>
          <tr>
            <td class="surat-col-label">Nama Lengkap</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val"><strong>${(a.nama || '').toUpperCase()}</strong></td>
          </tr>
          <tr>
            <td class="surat-col-label">Tempat / Tanggal Lahir</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${a.ttl || '-'}</td>
          </tr>
          <tr>
            <td class="surat-col-label">Alamat Lengkap</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${alamatLengkap}</td>
          </tr>
          <tr>
            <td class="surat-col-label">Nomor Ponsel / WhatsApp</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${kontak}</td>
          </tr>
          <tr>
            <td class="surat-col-label">Nama Ayah</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${a.wali || '-'}</td>
          </tr>
          <tr>
            <td class="surat-col-label">Nama Ibu</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${a.ibu || '-'}</td>
          </tr>
          <tr>
            <td class="surat-col-label">Jenis Disabilitas</td>
            <td class="surat-col-colon">:</td>
            <td class="surat-col-val">${disabilitasText}</td>
          </tr>
        </tbody>
      </table>

      <!-- PARAGRAF PENUTUP -->
      <p class="surat-paragraph">
        Demikian surat keterangan bukti pendaftaran ini diterbitkan untuk dipergunakan sebagaimana mestinya. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.
      </p>

      <!-- TANDA TANGAN (RIGHT ALIGNED) -->
      <div class="surat-ttd-container">
        <div class="surat-ttd-box">
          <div class="surat-ttd-date">Tanjungpinang, ${tanggalSurat}</div>
          <div class="surat-ttd-org">Yayasan Lentera Hati Gurindam</div>
          <div class="surat-ttd-role">Ketua Yayasan,</div>
          <div class="surat-ttd-name">KAMARIDA</div>
        </div>
      </div>
    </div>
  `;
}

function previewSuratPendaftaran() {
  const sel = document.getElementById('pdf-anggota-select');
  const container = document.getElementById('pdf-preview-container');
  if (!sel || !container) return;

  const id = sel.value;
  if (!id) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #475569;">Pilih data anak untuk melihat surat.</div>';
    return;
  }

  const a = DB.get('lhg_anggota').find(x => x.id === id);
  if (!a) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #EF4444;">Data tidak ditemukan.</div>';
    return;
  }

  container.innerHTML = buildSuratPendaftaranHTML(a);
}

function downloadSuratPendaftaranPDF(id) {
  const targetId = id || (document.getElementById('pdf-anggota-select') ? document.getElementById('pdf-anggota-select').value : null);
  if (!targetId) {
    showToast('Pilih calon peserta terlebih dahulu!', 'error');
    return;
  }

  const a = DB.get('lhg_anggota').find(x => x.id === targetId);
  if (!a) {
    showToast('Data calon peserta tidak ditemukan!', 'error');
    return;
  }

  const sel = document.getElementById('pdf-anggota-select');
  if (sel && sel.value !== targetId) {
    sel.value = targetId;
    previewSuratPendaftaran();
  }

  const element = document.getElementById('surat-a4-document');
  if (!element) {
    showToast('Elemen surat tidak ditemukan!', 'error');
    return;
  }

  if (typeof html2pdf === 'undefined') {
    showToast('Pustaka pembuat PDF sedang dimuat, beralih ke Cetak A4...', 'warning');
    printSuratPendaftaranPDF(targetId);
    return;
  }

  showToast('Memproses file PDF A4...');

  const cleanNama = (a.nama || 'Anak').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Surat_Pendaftaran_LHG_${a.noAnggota || a.id}_${cleanNama}.pdf`;

  const opt = {
    margin: [10, 14, 10, 14],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    showToast('PDF berhasil diunduh (1 lembar A4 penuh)!');
  }).catch(err => {
    console.error('Error generating PDF:', err);
    showToast('Gagal download PDF, beralih ke jendela cetak...');
    printSuratPendaftaranPDF(targetId);
  });
}

function printSuratPendaftaranPDF(id) {
  const targetId = id || (document.getElementById('pdf-anggota-select') ? document.getElementById('pdf-anggota-select').value : null);
  if (!targetId) {
    showToast('Pilih calon peserta terlebih dahulu!', 'error');
    return;
  }

  const a = DB.get('lhg_anggota').find(x => x.id === targetId);
  if (!a) {
    showToast('Data calon peserta tidak ditemukan!', 'error');
    return;
  }

  const suratHtml = buildSuratPendaftaranHTML(a);
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Keterangan Pendaftaran - ${a.nama}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 18mm 12mm 18mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
          background: #fff;
          padding: 0;
          margin: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .a4-paper {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 8px 0 0 0;
          box-shadow: none;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .kop-surat { text-align: center; margin-bottom: 20px; }
        .kop-logo-box { display: flex; flex-direction: column; align-items: center; margin-bottom: 4px; }
        .kop-logo-img { width: 72px; height: 72px; object-fit: contain; margin-bottom: 3px; }
        .kop-sublogo { font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px; color: #000; text-transform: uppercase; }
        .kop-org-name { font-size: 16px; font-weight: 900; letter-spacing: 0.4px; color: #000; margin: 7px 0 2px 0; text-transform: uppercase; line-height: 1.25; }
        .kop-org-prov { font-size: 13.5px; font-weight: 800; letter-spacing: 0.4px; color: #000; text-transform: uppercase; margin-bottom: 10px; }
        .kop-divider-double { border-top: 3px solid #000; border-bottom: 1px solid #000; height: 3.5px; width: 100%; margin: 0 auto; }
        .surat-doc-title { text-align: center; font-size: 14px; font-weight: 800; text-decoration: none; letter-spacing: 0.4px; margin: 24px 0 18px 0; text-transform: uppercase; color: #000; }
        .surat-paragraph { font-size: 12px; line-height: 1.7; color: #000; text-align: justify; margin-bottom: 16px; }
        .surat-data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 14px 0 20px 0; }
        .surat-data-table tr td { padding: 6px 4px; vertical-align: top; line-height: 1.55; }
        .surat-col-label { width: 215px; font-weight: 700; color: #000; }
        .surat-col-colon { width: 20px; text-align: center; font-weight: 700; color: #000; }
        .surat-col-val { color: #000; }
        .surat-ttd-container { display: flex; justify-content: flex-end; margin-top: 32px; }
        .surat-ttd-box { width: 260px; text-align: left; font-size: 12px; color: #000; }
        .surat-ttd-date { margin-bottom: 4px; }
        .surat-ttd-org { font-weight: 800; margin-bottom: 4px; }
        .surat-ttd-role { margin-bottom: 80px; }
        .surat-ttd-name { font-weight: 900; font-size: 12.5px; letter-spacing: 0.3px; text-decoration: none; }
      </style>
    </head>
    <body>
      ${suratHtml}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// ================= FORM PENDAFTARAN BLANKO A4 =================
function printFormPendaftaran() {
  const win = window.open('', '_blank');
  const now = new Date();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const ds = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Formulir Pendaftaran Anggota - Lentera Hati Gurindam</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; padding: 30px 35px; color: #0F172A; }
        .hdr { display: flex; align-items: center; justify-content: center; gap: 14px; border-bottom: 2.5px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
        .hdr img { width: 52px; height: 52px; object-fit: contain; }
        .hdr-text { text-align: center; }
        .hdr-text h1 { font-size: 16px; font-weight: 800; color: #0F172A; letter-spacing: 0.2px; }
        .hdr-text p { font-size: 10.5px; color: #059669; font-weight: 700; }
        .doc-title { text-align: center; font-size: 13px; font-weight: 800; text-transform: uppercase; text-decoration: underline; margin-bottom: 14px; }
        .sec { border: 1px solid #CBD5E1; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
        .sec-h { background: #F1F5F9; font-weight: 800; font-size: 10.5px; padding: 6px 10px; border-bottom: 1px solid #CBD5E1; color: #0F172A; }
        .sec-b { padding: 10px 12px; }
        .row { display: flex; gap: 12px; margin-bottom: 8px; }
        .col { flex: 1; }
        .col label { display: block; font-size: 9.5px; color: #475569; font-weight: 600; margin-bottom: 2px; }
        .line { border-bottom: 1px solid #94A3B8; min-height: 16px; }
        .cb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
        .cb-item { display: flex; align-items: center; gap: 5px; font-size: 10px; }
        .sq { width: 12px; height: 12px; border: 1.5px solid #059669; border-radius: 2px; }
        .sig-row { display: flex; justify-content: space-between; margin-top: 24px; text-align: center; }
        .sig-box { width: 160px; }
        .sig-line { border-bottom: 1px solid #0F172A; height: 50px; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="hdr">
        <img src="img/logo.png" alt="Logo LHG">
        <div class="hdr-text">
          <h1>LENTERA HATI GURINDAM</h1>
          <p>Organisasi Peduli Anak Disabilitas Kota Tanjungpinang - Kepulauan Riau</p>
        </div>
      </div>
      <div class="doc-title">Formulir Pendaftaran & Pendataan Anak Disabilitas</div>
      <div style="text-align: right; font-size: 10px; color: #64748B; margin-bottom: 10px;">Tanjungpinang, ${ds}</div>

      <div class="sec">
        <div class="sec-h">A. IDENTITAS PRIBADI ANAK</div>
        <div class="sec-b">
          <div class="row"><div class="col"><label>Nama Lengkap Anak</label><div class="line"></div></div></div>
          <div class="row">
            <div class="col"><label>Nomor Induk Kependudukan (NIK)</label><div class="line"></div></div>
            <div class="col"><label>Nomor Kartu Keluarga (KK)</label><div class="line"></div></div>
          </div>
          <div class="row">
            <div class="col"><label>Tempat, Tanggal Lahir</label><div class="line"></div></div>
            <div class="col"><label>Jenis Kelamin</label><div class="line"></div></div>
          </div>
          <div class="row">
            <div class="col"><label>Alamat Lengkap Domisili</label><div class="line"></div></div>
            <div class="col"><label>Kelurahan</label><div class="line"></div></div>
          </div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-h">B. RAGAM & KATEGORI DISABILITAS</div>
        <div class="sec-b">
          <div class="cb-grid">
            <div class="cb-item"><div class="sq"></div> Tuna Rungu</div>
            <div class="cb-item"><div class="sq"></div> Tuna Netra</div>
            <div class="cb-item"><div class="sq"></div> Tuna Grahita</div>
            <div class="cb-item"><div class="sq"></div> Autis</div>
            <div class="cb-item"><div class="sq"></div> Down Syndrome</div>
            <div class="cb-item"><div class="sq"></div> Disabilitas Berat</div>
            <div class="cb-item"><div class="sq"></div> Tuna Daksa Kursi Roda</div>
            <div class="cb-item"><div class="sq"></div> Tuna Daksa Tongkat</div>
            <div class="cb-item"><div class="sq"></div> Tuna Daksa Kaku</div>
            <div class="cb-item"><div class="sq"></div> Tuna Daksa Tanpa Tangan</div>
          </div>
          <div class="row" style="margin-top: 10px;"><div class="col"><label>Sub Disabilitas / Diagnosa Medis</label><div class="line"></div></div></div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-h">C. DATA ORANG TUA / WALI</div>
        <div class="sec-b">
          <div class="row">
            <div class="col"><label>Nama Ayah</label><div class="line"></div></div>
            <div class="col"><label>Nama Ibu</label><div class="line"></div></div>
          </div>
          <div class="row">
            <div class="col"><label>No. Telepon / WhatsApp</label><div class="line"></div></div>
            <div class="col"><label>Pekerjaan Orang Tua</label><div class="line"></div></div>
          </div>
        </div>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><p><strong>Orang Tua / Wali</strong></p></div>
        <div class="sig-box"><div class="sig-line"></div><p><strong>Petugas Pendata</strong></p></div>
        <div class="sig-box"><div class="sig-line"></div><p><strong>Ketua LHG Tanjungpinang</strong></p></div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ================= LAPORAN KEGIATAN =================
function renderLaporan() {
  const list = DB.get('lhg_kegiatan');
  const tbody = document.getElementById('laporan-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #94A3B8;">Belum ada laporan kegiatan</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((k, i) => `
    <tr>
      <td style="text-align: center; font-weight: 700; color: #64748B;">${i + 1}</td>
      <td style="font-weight: 700; color: #0F172A;">${k.judul}</td>
      <td>${formatDate(k.tanggal)}</td>
      <td>${k.lokasi || '-'}</td>
      <td style="text-align: center; font-weight: 800; color: #059669;">${k.peserta || 0} org</td>
      <td style="text-align: center;">
        <span class="disability-pill ${k.status === 'Selesai' ? 'badge-grahita' : 'badge-autis'}">${k.status}</span>
      </td>
      <td style="text-align: center;">
        <div class="action-buttons-group">
          <button class="btn-action-icon danger" onclick="deleteLaporan(${k.id})" title="Hapus">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddLaporan() {
  document.getElementById('form-laporan').reset();
  document.getElementById('modal-laporan').classList.add('open');
}

function saveLaporan() {
  const f = document.getElementById('form-laporan');
  if (!f.judul.value || !f.tanggal.value) {
    showToast('Harap isi judul dan tanggal kegiatan!', 'error');
    return;
  }
  const list = DB.get('lhg_kegiatan');
  list.unshift({
    id: Date.now(),
    judul: f.judul.value,
    tanggal: f.tanggal.value,
    peserta: parseInt(f.peserta.value) || 0,
    lokasi: f.lokasi.value,
    deskripsi: f.deskripsi.value,
    status: f.status_laporan.value
  });
  DB.set('lhg_kegiatan', list);
  closeModal('modal-laporan');
  renderLaporan();
  renderDashboard();
  showToast('Laporan kegiatan berhasil disimpan!');
}

async function deleteLaporan(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Laporan',
    message: 'Apakah Anda yakin ingin menghapus laporan kegiatan ini?',
    subtext: 'Laporan yang dihapus tidak dapat dipulihkan kembali.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  const list = DB.get('lhg_kegiatan').filter(x => x.id !== id);
  localStorage.setItem('lhg_kegiatan', JSON.stringify(list));
  try {
    await SupabaseAPI.delete('lhg_kegiatan', 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus laporan dari cloud:', e);
  }
  renderLaporan();
  renderDashboard();
  showToast('Laporan dihapus', 'warning');
}

// ================= SURAT MENYURAT =================
function switchSuratTab(type, btn) {
  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.surat-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById('tab-surat-' + type);
  if (target) target.classList.add('active');
}

function renderSurat() {
  const sm = DB.get('lhg_surat_masuk');
  const sk = DB.get('lhg_surat_keluar');

  setText('badge-sm-count', sm.length);
  setText('badge-sk-count', sk.length);

  const smList = document.getElementById('list-surat-masuk');
  if (smList) {
    smList.innerHTML = sm.map(s => `
      <div class="surat-item-card">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #ECFEFF; color: #0891B2; display: flex; align-items: center; justify-content: center; font-size: 18px;">📥</div>
          <div>
            <div style="font-weight: 800; font-size: 13px; color: #0F172A;">${s.perihal}</div>
            <div style="font-size: 11px; color: #64748B;">Pengirim: <strong>${s.pengirim}</strong> • No: ${s.nomor}</div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">${formatDate(s.tanggal)}</div>
          </div>
        </div>
        <button class="btn-action-icon danger" onclick="deleteSurat('masuk', ${s.id})" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }

  const skList = document.getElementById('list-surat-keluar');
  if (skList) {
    skList.innerHTML = sk.map(s => `
      <div class="surat-item-card">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #FEFCE8; color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 18px;">📤</div>
          <div>
            <div style="font-weight: 800; font-size: 13px; color: #0F172A;">${s.perihal}</div>
            <div style="font-size: 11px; color: #64748B;">Tujuan: <strong>${s.tujuan}</strong> • No: ${s.nomor}</div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">${formatDate(s.tanggal)}</div>
          </div>
        </div>
        <button class="btn-action-icon danger" onclick="deleteSurat('keluar', ${s.id})" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }
}

function openAddSurat(type) {
  document.getElementById('form-surat').reset();
  document.getElementById('surat-type').value = type;
  document.getElementById('surat-pengirim-group').style.display = type === 'masuk' ? 'block' : 'none';
  document.getElementById('surat-tujuan-group').style.display = type === 'keluar' ? 'block' : 'none';
  setText('modal-surat-title', type === 'masuk' ? 'Catat Surat Masuk' : 'Buat Surat Keluar');
  document.getElementById('modal-surat').classList.add('open');
}

function saveSurat() {
  const f = document.getElementById('form-surat');
  const type = f.surat_type.value;
  if (!f.nomor_surat.value || !f.perihal.value) {
    showToast('Harap isi nomor surat dan perihal!', 'error');
    return;
  }
  const key = type === 'masuk' ? 'lhg_surat_masuk' : 'lhg_surat_keluar';
  const list = DB.get(key);
  list.unshift({
    id: Date.now(),
    nomor: f.nomor_surat.value,
    tanggal: f.tgl_surat.value || new Date().toISOString().split('T')[0],
    perihal: f.perihal.value,
    pengirim: f.pengirim ? f.pengirim.value : '',
    tujuan: f.tujuan ? f.tujuan.value : '',
    keterangan: f.ket_surat.value
  });
  DB.set(key, list);
  closeModal('modal-surat');
  renderSurat();
  renderDashboard();
  showToast('Data surat berhasil disimpan!');
}

async function deleteSurat(type, id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Surat',
    message: 'Apakah Anda yakin ingin menghapus data surat ini?',
    subtext: 'Arsip surat yang dihapus tidak dapat dipulihkan kembali.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  const key = type === 'masuk' ? 'lhg_surat_masuk' : 'lhg_surat_keluar';
  const list = DB.get(key).filter(x => x.id !== id);
  localStorage.setItem(key, JSON.stringify(list));
  try {
    await SupabaseAPI.delete(key, 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus surat dari cloud:', e);
  }
  renderSurat();
  renderDashboard();
  showToast('Surat dihapus', 'warning');
}

// ==============================================================================
// FOTO KEGIATAN MODULE (PER KEGIATAN & MULTI-UPLOAD MAX 10 FOTO)
// ==============================================================================
const MAX_UPLOAD_FOTO = 10;
let selectedUploadPhotos = []; // array of { name, size, base64 }
let currentLightboxPhotoId = null;

function escapeHtmlStr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeForJsStr(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function renderFoto() {
  const container = document.getElementById('photo-grouped-container');
  if (!container) return;

  if (PhotoStore._cache === null && typeof window !== 'undefined' && window.indexedDB) {
    PhotoStore.getAll().then(() => renderFoto());
    return;
  }

  const rawList = DB.get('lhg_foto', []);
  const search = (document.getElementById('foto-search-input')?.value || '').toLowerCase().trim();
  const filterKat = (document.getElementById('foto-filter-kategori')?.value || '').trim();

  // Update total photos stat
  setText('stat-foto-total', rawList.length);

  // Group all photos by activity title (judul)
  const allGroups = {};
  rawList.forEach(item => {
    const titleKey = (item.judul || 'Kegiatan Tanpa Judul').trim();
    if (!allGroups[titleKey]) {
      allGroups[titleKey] = {
        judul: titleKey,
        tanggal: item.tanggal || '',
        kategori: item.kategori || 'Pelatihan',
        deskripsi: item.deskripsi || '',
        photos: []
      };
    }
    allGroups[titleKey].photos.push(item);
    if (item.tanggal && (!allGroups[titleKey].tanggal || item.tanggal > allGroups[titleKey].tanggal)) {
      allGroups[titleKey].tanggal = item.tanggal;
    }
  });

  const totalActivities = Object.keys(allGroups).length;
  setText('stat-foto-kegiatan-total', totalActivities);

  // Filter groups
  let groupsArray = Object.values(allGroups);

  if (filterKat) {
    groupsArray = groupsArray.filter(g => (g.kategori || '').toLowerCase() === filterKat.toLowerCase());
  }

  if (search) {
    groupsArray = groupsArray.filter(g => 
      g.judul.toLowerCase().includes(search) || 
      (g.deskripsi && g.deskripsi.toLowerCase().includes(search)) ||
      (g.kategori && g.kategori.toLowerCase().includes(search))
    );
  }

  // Sort by latest date descending
  groupsArray.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  if (groupsArray.length === 0) {
    container.innerHTML = `
      <div class="foto-empty-state">
        <div class="foto-empty-icon">📸</div>
        <h4>${rawList.length === 0 ? 'Belum Ada Dokumentasi Foto Kegiatan' : 'Tidak Ada Kegiatan yang Cocok'}</h4>
        <p>${rawList.length === 0 ? 'Koleksi dokumentasi foto kegiatan akan ditampilkan rapi dikelompokkan per kegiatan (hingga 10 foto per unggahan).' : 'Coba ubah kata kunci pencarian atau reset filter kategori untuk melihat kegiatan lainnya.'}</p>
        <button type="button" class="btn-prim" onclick="openAddFoto()" style="margin-top: 14px;">
          <span>➕ Unggah Foto Kegiatan</span>
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = groupsArray.map(group => {
    const katBadgeClass = 'badge-' + (group.kategori || 'lainnya').toLowerCase().replace(/\s+/g, '-');
    return `
      <div class="kegiatan-album-card">
        <div class="kegiatan-album-header">
          <div class="kegiatan-album-info">
            <div class="kegiatan-album-title-wrap">
              <span class="kegiatan-badge ${katBadgeClass}">${escapeHtmlStr(group.kategori || 'Kegiatan')}</span>
              <h4 class="kegiatan-album-title">${escapeHtmlStr(group.judul)}</h4>
            </div>
            <div class="kegiatan-album-meta">
              <span>📅 ${formatDate(group.tanggal)}</span>
              <span>📸 ${group.photos.length} Foto Dokumentasi</span>
              ${group.deskripsi ? `<span>• ${escapeHtmlStr(group.deskripsi)}</span>` : ''}
            </div>
          </div>
          <div class="kegiatan-album-actions">
            <button type="button" class="btn-album-action" onclick="openAddFotoForKegiatan('${escapeForJsStr(group.judul)}', '${escapeForJsStr(group.tanggal)}', '${escapeForJsStr(group.kategori)}', '${escapeForJsStr(group.deskripsi)}')">
              <span>➕ Tambah Foto</span>
            </button>
            <button type="button" class="btn-album-delete" onclick="deleteAlbumKegiatan('${escapeForJsStr(group.judul)}')">
              <span>🗑️ Hapus Album</span>
            </button>
          </div>
        </div>

        <div class="kegiatan-album-grid">
          ${group.photos.map((p, idx) => `
            <div class="kegiatan-photo-item" onclick="openLightboxDetail(${p.id})">
              <img src="${p.url}" alt="${escapeHtmlStr(group.judul)}" loading="lazy">
              <div class="kegiatan-photo-overlay">
                <span class="kegiatan-photo-zoom">🔍</span>
                <button type="button" class="kegiatan-photo-delete-btn" title="Hapus foto ini" onclick="event.stopPropagation(); deleteSingleFoto(${p.id})">
                  🗑️
                </button>
              </div>
              <div class="kegiatan-photo-idx">#${idx + 1}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function openAddFoto(prefillJudul = '', prefillTanggal = '', prefillKategori = '', prefillDeskripsi = '') {
  const form = document.getElementById('form-foto');
  if (form) form.reset();

  selectedUploadPhotos = [];
  renderSelectedPhotosPreview();

  // Populate existing kegiatan select
  const selectExist = document.getElementById('foto-select-kegiatan-exist');
  if (selectExist) {
    const listKegiatan = DB.get('lhg_kegiatan', []);
    const listFoto = DB.get('lhg_foto', []);
    
    // Unique names from both
    const uniqueTitles = new Map();
    listKegiatan.forEach(k => {
      if (k.judul) uniqueTitles.set(k.judul.trim(), { judul: k.judul.trim(), tanggal: k.tanggal, kategori: 'Pelatihan', deskripsi: k.deskripsi || '' });
    });
    listFoto.forEach(f => {
      if (f.judul && !uniqueTitles.has(f.judul.trim())) {
        uniqueTitles.set(f.judul.trim(), { judul: f.judul.trim(), tanggal: f.tanggal, kategori: f.kategori, deskripsi: f.deskripsi || '' });
      }
    });

    let opts = '<option value="">-- Ketik Judul Kegiatan Baru --</option>';
    uniqueTitles.forEach(val => {
      opts += `<option value="${escapeHtmlStr(val.judul)}" data-tgl="${escapeHtmlStr(val.tanggal || '')}" data-kat="${escapeHtmlStr(val.kategori || '')}" data-desk="${escapeHtmlStr(val.deskripsi || '')}">${escapeHtmlStr(val.judul)} (${formatDate(val.tanggal)})</option>`;
    });
    selectExist.innerHTML = opts;
  }

  const judulEl = document.getElementById('foto-judul-kegiatan');
  const tglEl = document.getElementById('foto-tanggal-kegiatan');
  const katEl = document.getElementById('foto-kategori-kegiatan');
  const deskEl = document.getElementById('foto-deskripsi-kegiatan');

  if (prefillJudul) {
    if (selectExist) selectExist.value = prefillJudul;
    if (judulEl) judulEl.value = prefillJudul;
    if (tglEl) tglEl.value = prefillTanggal || new Date().toISOString().split('T')[0];
    if (katEl) katEl.value = prefillKategori || 'Pelatihan';
    if (deskEl) deskEl.value = prefillDeskripsi || '';
  } else {
    if (selectExist) selectExist.value = '';
    if (judulEl) judulEl.value = '';
    if (tglEl) tglEl.value = new Date().toISOString().split('T')[0];
    if (katEl) katEl.value = 'Pelatihan';
    if (deskEl) deskEl.value = '';
  }

  const modal = document.getElementById('modal-foto-kegiatan');
  if (modal) {
    modal.classList.add('open');
    document.body.classList.add('modal-open');
  }
}

function openAddFotoForKegiatan(judul, tanggal, kategori, deskripsi) {
  openAddFoto(judul, tanggal, kategori, deskripsi);
}

function handleSelectExistingKegiatan(selectedTitle) {
  const judulEl = document.getElementById('foto-judul-kegiatan');
  const tglEl = document.getElementById('foto-tanggal-kegiatan');
  const katEl = document.getElementById('foto-kategori-kegiatan');
  const deskEl = document.getElementById('foto-deskripsi-kegiatan');
  const selectExist = document.getElementById('foto-select-kegiatan-exist');

  if (!selectedTitle) {
    if (judulEl) judulEl.value = '';
    return;
  }

  if (judulEl) judulEl.value = selectedTitle;

  const opt = selectExist ? selectExist.querySelector(`option[value="${CSS.escape(selectedTitle)}"]`) : null;
  if (opt) {
    const tgl = opt.getAttribute('data-tgl');
    const kat = opt.getAttribute('data-kat');
    const desk = opt.getAttribute('data-desk');
    if (tgl && tglEl) tglEl.value = tgl;
    if (kat && katEl) katEl.value = kat;
    if (desk && deskEl) deskEl.value = desk;
  }
}

// Drag & drop handlers
function handleFotoDragOver(e) {
  e.preventDefault();
  const dz = document.getElementById('foto-dropzone');
  if (dz) dz.classList.add('dragover');
}

function handleFotoDragLeave(e) {
  e.preventDefault();
  const dz = document.getElementById('foto-dropzone');
  if (dz) dz.classList.remove('dragover');
}

function handleFotoDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('foto-dropzone');
  if (dz) dz.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    processSelectedFotoFiles(Array.from(e.dataTransfer.files));
  }
}

function handleFotoFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  processSelectedFotoFiles(files);
  event.target.value = '';
}

function processSelectedFotoFiles(newFiles) {
  const imageFiles = newFiles.filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('Harap pilih file gambar yang valid (JPG, PNG, WebP)!', 'error');
    return;
  }

  const remainingSlots = MAX_UPLOAD_FOTO - selectedUploadPhotos.length;
  if (remainingSlots <= 0) {
    showToast(`Batas maksimal ${MAX_UPLOAD_FOTO} foto telah tercapai! Hapus beberapa foto untuk menambah foto baru.`, 'warning');
    return;
  }

  let filesToProcess = imageFiles;
  if (imageFiles.length > remainingSlots) {
    filesToProcess = imageFiles.slice(0, remainingSlots);
    showToast(`Maksimal ${MAX_UPLOAD_FOTO} foto sekali upload! Hanya ${remainingSlots} foto yang ditambahkan.`, 'warning');
  }

  showToast(`Memproses & mengoptimasi ${filesToProcess.length} foto...`, 'info');

  let processedCount = 0;
  filesToProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      compressImage(e.target.result, 960, 960, 0.70, function(compressedBase64) {
        selectedUploadPhotos.push({
          name: file.name,
          size: file.size,
          base64: compressedBase64
        });
        processedCount++;
        if (processedCount === filesToProcess.length) {
          renderSelectedPhotosPreview();
          showToast(`${filesToProcess.length} foto siap diunggah! (${selectedUploadPhotos.length}/${MAX_UPLOAD_FOTO})`, 'success');
        }
      });
    };
    reader.readAsDataURL(file);
  });
}

function renderSelectedPhotosPreview() {
  const container = document.getElementById('foto-preview-container');
  const grid = document.getElementById('foto-selected-grid');
  const counterBadge = document.getElementById('foto-selected-counter-badge');

  if (!container || !grid) return;

  if (selectedUploadPhotos.length === 0) {
    container.style.display = 'none';
    if (counterBadge) counterBadge.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  if (counterBadge) {
    counterBadge.style.display = 'inline-block';
    counterBadge.textContent = `${selectedUploadPhotos.length} / ${MAX_UPLOAD_FOTO} Foto Terpilih`;
  }

  grid.innerHTML = selectedUploadPhotos.map((photo, index) => `
    <div class="foto-preview-thumb-box">
      <img src="${photo.base64}" alt="${escapeHtmlStr(photo.name)}">
      <button type="button" class="foto-preview-thumb-remove" onclick="removeSelectedFotoUpload(${index})" title="Hapus foto ini">✕</button>
      <span class="foto-preview-thumb-idx">#${index + 1}</span>
    </div>
  `).join('');
}

function removeSelectedFotoUpload(index) {
  selectedUploadPhotos.splice(index, 1);
  renderSelectedPhotosPreview();
}

function clearSelectedFotoUpload() {
  selectedUploadPhotos = [];
  renderSelectedPhotosPreview();
  showToast('Daftar foto yang dipilih telah dibersihkan.', 'info');
}

async function saveFotoMulti() {
  const judul = (document.getElementById('foto-judul-kegiatan')?.value || '').trim();
  const tanggal = document.getElementById('foto-tanggal-kegiatan')?.value || new Date().toISOString().split('T')[0];
  const kategori = document.getElementById('foto-kategori-kegiatan')?.value || 'Pelatihan';
  const deskripsi = (document.getElementById('foto-deskripsi-kegiatan')?.value || '').trim();
  const btn = document.getElementById('btn-submit-foto');

  if (!judul) {
    showToast('Harap isi nama atau judul kegiatan!', 'error');
    return;
  }

  if (selectedUploadPhotos.length === 0) {
    showToast('Pilih minimal 1 foto kegiatan untuk diunggah (maksimal 10 foto)!', 'error');
    return;
  }

  if (selectedUploadPhotos.length > MAX_UPLOAD_FOTO) {
    showToast(`Maksimal ${MAX_UPLOAD_FOTO} foto sekali upload!`, 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Menyimpan ${selectedUploadPhotos.length} Foto...</span>`;
  }

  try {
    const list = DB.get('lhg_foto', []);
    const newItems = [];
    const baseTime = Date.now();

    selectedUploadPhotos.forEach((photo, idx) => {
      const newItem = {
        id: baseTime + idx,
        judul: judul,
        tanggal: tanggal,
        kategori: kategori,
        deskripsi: deskripsi,
        url: photo.base64
      };
      newItems.push(newItem);
      list.unshift(newItem);
    });

    // Save to Local DB
    DB.set('lhg_foto', list);

    // Direct cloud sync to Supabase
    try {
      const cloudRows = newItems.map(item => toSupabaseRow('lhg_foto', item));
      await SupabaseAPI.upsert('lhg_foto', cloudRows);
    } catch(err) {
      console.warn('Sync foto ke cloud tertunda:', err);
    }

    closeModal('modal-foto-kegiatan');
    renderFoto();
    showToast(`Berhasil mengunggah ${newItems.length} foto untuk kegiatan "${judul}"!`, 'success');
  } catch (err) {
    console.error('Gagal menyimpan foto:', err);
    showToast('Gagal menyimpan foto: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Simpan & Unggah Foto</span>';
    }
  }
}

async function deleteSingleFoto(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Foto Kegiatan',
    message: 'Apakah Anda yakin ingin menghapus foto dokumentasi ini?',
    subtext: 'Foto yang dihapus tidak dapat dipulihkan kembali.',
    confirmText: 'Ya, Hapus Foto',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;

  let list = DB.get('lhg_foto', []).filter(f => f.id !== id);
  DB.set('lhg_foto', list);

  try {
    await SupabaseAPI.delete('lhg_foto', 'id', id);
  } catch(e) {
    console.warn('Gagal menghapus foto dari cloud:', e);
  }

  closeLightbox();
  renderFoto();
  showToast('Foto berhasil dihapus.', 'warning');
}

async function deleteAlbumKegiatan(judul) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Seluruh Album Kegiatan',
    message: `Apakah Anda yakin ingin menghapus seluruh dokumentasi kegiatan "${judul}"?`,
    subtext: 'Semua foto di dalam kegiatan ini akan dihapus permanen dari sistem.',
    confirmText: 'Ya, Hapus Seluruh Album',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;

  const rawList = DB.get('lhg_foto', []);
  const toDelete = rawList.filter(f => (f.judul || '').trim() === judul.trim());
  const remaining = rawList.filter(f => (f.judul || '').trim() !== judul.trim());

  DB.set('lhg_foto', remaining);

  try {
    for (const item of toDelete) {
      await SupabaseAPI.delete('lhg_foto', 'id', item.id);
    }
  } catch(e) {
    console.warn('Gagal menghapus album foto dari cloud:', e);
  }

  renderFoto();
  showToast(`Album kegiatan "${judul}" dan ${toDelete.length} foto berhasil dihapus.`, 'warning');
}

function openLightboxDetail(id) {
  const list = DB.get('lhg_foto', []);
  const photo = list.find(p => p.id === id);
  if (!photo) return;

  currentLightboxPhotoId = id;
  const imgEl = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');
  const subEl = document.getElementById('lightbox-sub');
  const dlBtn = document.getElementById('lightbox-btn-download');

  if (imgEl) imgEl.src = photo.url;
  if (captionEl) captionEl.textContent = photo.judul || 'Dokumentasi Kegiatan';
  if (subEl) subEl.textContent = `${formatDate(photo.tanggal)} • Kategori: ${photo.kategori || 'Kegiatan'}${photo.deskripsi ? ' • ' + photo.deskripsi : ''}`;
  if (dlBtn) {
    dlBtn.href = photo.url;
    dlBtn.download = `${(photo.judul || 'foto-kegiatan').toLowerCase().replace(/\s+/g, '-')}-${photo.id}.jpg`;
  }

  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.add('open');
}

function openLightbox(url, caption) {
  const imgEl = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');
  if (imgEl) imgEl.src = url;
  if (captionEl) captionEl.textContent = caption;
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.add('open');
}

function closeLightbox() {
  currentLightboxPhotoId = null;
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
}

function deleteCurrentLightboxPhoto() {
  if (currentLightboxPhotoId !== null) {
    deleteSingleFoto(currentLightboxPhotoId);
  }
}

// ==============================================================================
// ARSIP BERKAS YAYASAN MODULE
// ==============================================================================
let activeArsipKategori = '';

function getArsipList() {
  return DB.get('lhg_arsip', []);
}

function filterArsipByKategori(cat) {
  activeArsipKategori = cat;
  const search = document.getElementById('arsip-search-input')?.value || '';
  renderArsipTable(search);
}

function renderArsip(search) {
  renderArsipStats();
  renderArsipTable(search);
}

function renderArsipStats() {
  const list = getArsipList();
  const total = list.length;
  const legalitas = list.filter(a => a.kategori === 'Legalitas & Perizinan').length;
  const sk = list.filter(a => a.kategori === 'Surat Keputusan (SK)').length;
  const lainnya = total - legalitas - sk;

  setText('stat-arsip-total', total);
  setText('stat-arsip-legalitas', legalitas);
  setText('stat-arsip-sk', sk);
  setText('stat-arsip-lainnya', Math.max(0, lainnya));
}

function renderArsipTable(search) {
  search = (search || '').toLowerCase().trim();
  let list = getArsipList();

  if (activeArsipKategori) {
    list = list.filter(a => a.kategori === activeArsipKategori);
  }

  if (search) {
    list = list.filter(a => {
      const nama = (a.nama || '').toLowerCase();
      const nomor = (a.nomor || '').toLowerCase();
      const penerbit = (a.penerbit || '').toLowerCase();
      const lokasi = (a.lokasiFisik || '').toLowerCase();
      const ket = (a.keterangan || '').toLowerCase();
      return nama.includes(search) || nomor.includes(search) || penerbit.includes(search) || lokasi.includes(search) || ket.includes(search);
    });
  }

  // Urutkan tanggal terbaru / ID terbaru di atas
  list.sort((a, b) => new Date(b.tanggal || b.id || 0) - new Date(a.tanggal || a.id || 0));

  const tbody = document.getElementById('arsip-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 38px; margin-bottom: 8px;">📁</div>
          <p style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Belum Ada Berkas yang Diarsipkan</p>
          <p style="font-size: 12px;">Klik tombol "Simpan Arsip Berkas" di atas untuk menambahkan dokumen resmi yayasan.</p>
        </td>
      </tr>
    `;
    return;
  }

  const badgeKategoriMap = {
    'Legalitas & Perizinan': { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', icon: '📜' },
    'Surat Keputusan (SK)': { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D', icon: '⚖️' },
    'Laporan & LPJ': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', icon: '📊' },
    'Kerjasama & MoU': { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE', icon: '🤝' },
    'Aset & Inventaris': { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: '🏛️' },
    'Administrasi & Lainnya': { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: '📁' }
  };

  tbody.innerHTML = list.map((a, idx) => {
    const katStyle = badgeKategoriMap[a.kategori] || badgeKategoriMap['Administrasi & Lainnya'];
    const hasDigital = a.fileUrl || a.fileBase64;
    return `
      <tr>
        <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
        <td style="white-space: nowrap;">
          <div style="font-weight: 700; color: #1E293B; font-size: 12.5px;">${a.nomor || '<span style="color:#94A3B8; font-style:italic;">Tanpa Nomor</span>'}</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">📅 ${a.tanggal ? formatDate(a.tanggal) : '-'}</div>
        </td>
        <td>
          <div style="font-weight: 800; font-size: 13.5px; color: #047857; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="viewArsip(${a.id})" title="Klik untuk membuka jendela data arsip lengkap">
            <span>📄</span> <span style="text-decoration: underline;">${a.nama}</span>
          </div>
          ${a.penerbit ? `<div style="font-size: 11px; color: #64748B; margin-top: 2px;">Instansi: <strong>${a.penerbit}</strong></div>` : ''}
          ${a.keterangan ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; font-style: italic;">"${a.keterangan.length > 70 ? a.keterangan.slice(0, 70) + '...' : a.keterangan}"</div>` : ''}
        </td>
        <td>
          <span style="background: ${katStyle.bg}; color: ${katStyle.color}; border: 1px solid ${katStyle.border}; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            ${katStyle.icon} ${a.kategori}
          </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px; cursor: pointer;" onclick="viewArsip(${a.id})" title="Lihat detail lokasi fisik di jendela">
            <span style="font-size: 14px;">📍</span>
            <span style="font-weight: 600; font-size: 12px; color: #065F46; background: #ECFDF5; padding: 2px 7px; border-radius: 6px; border: 1px solid #A7F3D0;">${a.lokasiFisik || '-'}</span>
          </div>
        </td>
        <td style="text-align: center;">
          ${hasDigital ? `
            <button type="button" class="btn-sec" onclick="viewArsip(${a.id})" style="padding: 4px 10px; font-size: 11px; font-weight: 700; color: #047857; background: #ECFDF5; border-color: #A7F3D0; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Lihat pratinjau berkas digital di jendela">
              <span>📎</span> ${a.fileName ? 'Buka Dokumen' : 'Buka Link'}
            </button>
          ` : `
            <span style="font-size: 11px; color: #64748B; background: #F1F5F9; padding: 3px 8px; border-radius: 6px; border: 1px solid #E2E8F0; display: inline-flex; align-items: center; gap: 4px;">
              <span>📦</span> Fisik
            </span>
          `}
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 5px; justify-content: center; align-items: center;">
            <button type="button" onclick="viewArsip(${a.id})" title="Buka Jendela Data Lengkap" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; background: #EFF6FF; border: 1px solid #BFDBFE; color: #1D4ED8; border-radius: 6px; font-weight: 700; font-size: 11.5px; cursor: pointer; transition: all 0.15s;">
              <span>👁️</span> <span>View</span>
            </button>
            <button class="btn-action-icon edit" onclick="openEditArsip(${a.id})" title="Edit Arsip">✏️</button>
            <button class="btn-action-icon delete" onclick="deleteArsip(${a.id})" title="Hapus Berkas">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function handleArsipFileInput(event) {
  const file = event.target.files[0];
  const infoEl = document.getElementById('arsip-file-preview-info');
  const base64El = document.getElementById('arsip-file-base64');
  const nameEl = document.getElementById('arsip-file-name');

  if (!file) {
    base64El.value = '';
    nameEl.value = '';
    if (infoEl) infoEl.style.display = 'none';
    return;
  }

  // Batas ukuran 5MB
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file terlalu besar! Maksimal 5MB.', 'error');
    event.target.value = '';
    base64El.value = '';
    nameEl.value = '';
    if (infoEl) infoEl.style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    base64El.value = e.target.result;
    nameEl.value = file.name;
    if (infoEl) {
      infoEl.style.display = 'block';
      const sizeKb = Math.round(file.size / 1024);
      infoEl.innerHTML = `✅ <strong>${file.name}</strong> (${sizeKb} KB) siap disimpan.`;
    }
  };
  reader.readAsDataURL(file);
}

function openAddArsip() {
  document.getElementById('form-arsip').reset();
  document.getElementById('arsip-edit-id').value = '';
  document.getElementById('arsip-file-base64').value = '';
  document.getElementById('arsip-file-name').value = '';
  const infoEl = document.getElementById('arsip-file-preview-info');
  if (infoEl) {
    infoEl.style.display = 'none';
    infoEl.innerHTML = '';
  }

  setText('modal-arsip-title', 'Simpan Arsip Berkas Yayasan');

  // Set default tanggal hari ini
  const today = new Date().toISOString().split('T')[0];
  const tglInput = document.getElementById('arsip-tanggal');
  if (tglInput) tglInput.value = today;

  document.getElementById('modal-arsip').classList.add('open');
}

function openEditArsip(id) {
  const list = getArsipList();
  const a = list.find(x => x.id === id);
  if (!a) return;

  document.getElementById('form-arsip').reset();
  document.getElementById('arsip-edit-id').value = a.id;
  document.getElementById('arsip-nama').value = a.nama || '';
  document.getElementById('arsip-kategori').value = a.kategori || 'Legalitas & Perizinan';
  document.getElementById('arsip-nomor').value = a.nomor || '';
  document.getElementById('arsip-tanggal').value = a.tanggal || '';
  document.getElementById('arsip-penerbit').value = a.penerbit || '';
  document.getElementById('arsip-lokasi').value = a.lokasiFisik || '';
  document.getElementById('arsip-file-url').value = a.fileUrl || '';
  document.getElementById('arsip-file-base64').value = a.fileBase64 || '';
  document.getElementById('arsip-file-name').value = a.fileName || '';
  document.getElementById('arsip-keterangan').value = a.keterangan || '';

  const infoEl = document.getElementById('arsip-file-preview-info');
  if (infoEl) {
    if (a.fileName) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `📎 Berkas tersimpan: <strong>${a.fileName}</strong>. Pilih file baru jika ingin mengganti.`;
    } else {
      infoEl.style.display = 'none';
    }
  }

  setText('modal-arsip-title', 'Edit Arsip Berkas Yayasan');
  document.getElementById('modal-arsip').classList.add('open');
}

function saveArsip() {
  const editId = document.getElementById('arsip-edit-id').value;
  const nama = document.getElementById('arsip-nama').value.trim();
  const kategori = document.getElementById('arsip-kategori').value;
  const nomor = document.getElementById('arsip-nomor').value.trim();
  const tanggal = document.getElementById('arsip-tanggal').value;
  const penerbit = document.getElementById('arsip-penerbit').value.trim();
  const lokasiFisik = document.getElementById('arsip-lokasi').value.trim();
  const fileUrl = document.getElementById('arsip-file-url').value.trim();
  const fileBase64 = document.getElementById('arsip-file-base64').value;
  const fileName = document.getElementById('arsip-file-name').value;
  const keterangan = document.getElementById('arsip-keterangan').value.trim();

  if (!nama || !lokasiFisik) {
    showToast('Harap lengkapi judul dokumen dan lokasi penyimpanan fisik!', 'error');
    return;
  }

  let list = getArsipList();
  const user = getAuthUser();
  const uploader = user ? (user.nama || user.username) : 'Pengurus Yayasan';

  if (editId) {
    const idx = list.findIndex(x => x.id === parseInt(editId));
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        nama: nama,
        kategori: kategori,
        nomor: nomor,
        tanggal: tanggal,
        penerbit: penerbit,
        lokasiFisik: lokasiFisik,
        fileUrl: fileUrl,
        fileBase64: fileBase64 || list[idx].fileBase64,
        fileName: fileName || list[idx].fileName,
        keterangan: keterangan
      };
      DB.set('lhg_arsip', list);
      showToast('Arsip berkas berhasil diperbarui!', 'success');
    }
  } else {
    const newRecord = {
      id: Date.now(),
      nama: nama,
      kategori: kategori,
      nomor: nomor,
      tanggal: tanggal,
      penerbit: penerbit,
      lokasiFisik: lokasiFisik,
      fileUrl: fileUrl,
      fileBase64: fileBase64,
      fileName: fileName,
      keterangan: keterangan,
      uploadedBy: uploader
    };
    list.unshift(newRecord);
    DB.set('lhg_arsip', list);
    showToast('Arsip berkas berhasil disimpan!', 'success');
  }

  closeModal('modal-arsip');
  renderArsip();
}

async function deleteArsip(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Berkas Arsip',
    message: 'Apakah Anda yakin ingin menghapus arsip berkas ini?',
    subtext: 'Dokumen dan file arsip akan dihapus dari sistem.',
    confirmText: 'Ya, Hapus Arsip',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  let list = getArsipList().filter(x => x.id !== id);
  localStorage.setItem('lhg_arsip', JSON.stringify(list));
  try {
    await SupabaseAPI.delete('lhg_arsip', 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus arsip dari cloud:', e);
  }
  renderArsip();
  showToast('Arsip berkas telah dihapus.', 'warning');
}

let activeArsipBlobUrl = null;

function getArsipPdfBlobUrl(base64Data) {
  if (!base64Data) return null;
  try {
    const parts = base64Data.split(',');
    const raw = parts.length > 1 ? parts[1] : parts[0];
    const byteCharacters = atob(raw);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Error creating PDF Blob URL:', e);
    return null;
  }
}

function openArsipPdfInNewTab(id) {
  const list = getArsipList();
  const a = list.find(x => String(x.id) === String(id));
  if (!a || !a.fileBase64) {
    showToast('File dokumen tidak ditemukan!', 'error');
    return;
  }
  const blobUrl = getArsipPdfBlobUrl(a.fileBase64);
  if (blobUrl) {
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      showToast('Pop-up diblokir oleh browser. Mengunduh file sebagai gantinya...', 'warning');
      downloadArsipFile(id);
    }
  } else {
    showToast('Gagal memproses file PDF!', 'error');
  }
}

function downloadArsipFile(id) {
  const list = getArsipList();
  const a = list.find(x => String(x.id) === String(id));
  if (!a || !a.fileBase64) {
    showToast('File dokumen tidak ditemukan!', 'error');
    return;
  }
  try {
    const isPdf = a.fileBase64.startsWith('data:application/pdf') || (a.fileName && a.fileName.toLowerCase().endsWith('.pdf'));
    const mimeType = isPdf ? 'application/pdf' : 'application/octet-stream';
    const parts = a.fileBase64.split(',');
    const raw = parts.length > 1 ? parts[1] : parts[0];
    const byteCharacters = atob(raw);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.fileName || (isPdf ? 'dokumen_arsip.pdf' : 'dokumen_arsip');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (e) {
    showToast('Gagal mengunduh berkas: ' + e.message, 'error');
  }
}

function viewArsip(id) {
  const list = getArsipList();
  const a = list.find(x => x.id === id);
  if (!a) return;

  // Revoke previous blob if any
  if (activeArsipBlobUrl) {
    URL.revokeObjectURL(activeArsipBlobUrl);
    activeArsipBlobUrl = null;
  }

  const badgeKategoriMap = {
    'Legalitas & Perizinan': { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', icon: '📜' },
    'Surat Keputusan (SK)': { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D', icon: '⚖️' },
    'Laporan & LPJ': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', icon: '📊' },
    'Kerjasama & MoU': { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE', icon: '🤝' },
    'Aset & Inventaris': { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: '🏛️' },
    'Administrasi & Lainnya': { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: '📁' }
  };
  const katStyle = badgeKategoriMap[a.kategori] || badgeKategoriMap['Administrasi & Lainnya'];

  setText('view-arsip-nama', a.nama);
  setText('view-arsip-nomor', a.nomor ? `Nomor Dokumen: ${a.nomor}` : 'Dokumen Tanpa Nomor Resmi');

  const body = document.getElementById('view-arsip-body');
  const actions = document.getElementById('view-arsip-actions');
  const leftActions = document.getElementById('view-arsip-left-actions');
  if (!body) return;

  const isPdf = a.fileBase64 && (a.fileBase64.startsWith('data:application/pdf') || (a.fileName && a.fileName.toLowerCase().endsWith('.pdf')));
  const isImg = a.fileBase64 && (a.fileBase64.startsWith('data:image/') || (a.fileName && /\.(jpg|jpeg|png|webp)$/i.test(a.fileName)));

  let pdfBlobUrl = null;
  if (isPdf) {
    pdfBlobUrl = getArsipPdfBlobUrl(a.fileBase64);
    activeArsipBlobUrl = pdfBlobUrl;
  }

  body.innerHTML = `
    <!-- KOTAK UTAMA: LOKASI FISIK PENYIMPANAN DI KANTOR -->
    <div style="background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border: 1.5px solid #86EFAC; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.08);">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          📍
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.6px;">Lokasi Penyimpanan Fisik Berkas di Kantor:</div>
          <div style="font-size: 17px; font-weight: 800; color: #064E3B; margin-top: 2px;">${a.lokasiFisik}</div>
          <div style="font-size: 11.5px; color: #047857; margin-top: 3px;">💡 Ambil map atau bantex fisik di lemari tersebut jika memerlukan berkas bertandatangan dan berstempel asli.</div>
        </div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <span style="background: white; border: 1px solid #86EFAC; padding: 6px 14px; border-radius: 20px; font-size: 11.5px; font-weight: 700; color: #059669; display: inline-flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span> Tersedia
        </span>
      </div>
    </div>

    <!-- RINCIAN DATA LENGKAP -->
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Informasi Detail Berkas Yayasan</div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; font-size: 13px;">
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Nama / Judul Dokumen:</span>
          <strong style="color: #0F172A; font-size: 14px;">${a.nama}</strong>
        </div>
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Kategori Klasifikasi:</span>
          <span style="background: ${katStyle.bg}; color: ${katStyle.color}; border: 1px solid ${katStyle.border}; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;">
            ${katStyle.icon} ${a.kategori}
          </span>
        </div>
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Nomor / Kode Resmi:</span>
          <strong style="color: #0F172A; font-family: monospace; font-size: 13px;">${a.nomor || '<span style="color:#94A3B8; font-weight: normal; font-style: italic;">(Tidak ada nomor resmi)</span>'}</strong>
        </div>
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Tanggal Dokumen / Pengesahan:</span>
          <strong style="color: #0F172A;">📅 ${a.tanggal ? formatDate(a.tanggal) : '-'}</strong>
        </div>
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Instansi / Lembaga Penerbit:</span>
          <strong style="color: #0F172A;">🏛️ ${a.penerbit || '-'}</strong>
        </div>
        <div>
          <span style="color: #64748B; font-size: 11.5px; display: block;">Petugas yang Mencatat:</span>
          <span style="color: #334155; font-size: 12.5px;">👤 <strong>${a.uploadedBy || 'Pengurus Yayasan'}</strong></span>
        </div>
      </div>

      ${a.keterangan ? `
        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #CBD5E1;">
          <span style="color: #64748B; font-size: 11.5px; font-weight: 700; display: block; margin-bottom: 4px;">Uraian & Ringkasan Dokumen:</span>
          <p style="color: #1E293B; font-size: 13px; line-height: 1.6; margin: 0; background: white; padding: 12px 14px; border-radius: 8px; border: 1px solid #E2E8F0;">${a.keterangan}</p>
        </div>
      ` : ''}
    </div>

    <!-- PRATINJAU DOKUMEN DIGITAL (INTERACTIVE VIEWER) -->
    <div style="margin-top: 10px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-weight: 800; font-size: 13px; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">Pratinjau / Lampiran Berkas Digital</span>
      </div>

      ${isPdf && pdfBlobUrl ? `
        <div style="background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- ACTION HEADER KHUSUS PDF -->
          <div style="background: #F0FDF4; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #86EFAC; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">📄</span>
              <div>
                <strong style="font-size: 13.5px; color: #065F46; display: block;">${a.fileName || 'Dokumen PDF'}</strong>
                <span style="font-size: 11px; color: #047857; font-weight: 600;">✓ Format Dokumen PDF Resmi • Siap Dibaca & Dicetak</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn-prim" onclick="openArsipPdfInNewTab('${a.id}')" style="padding: 7px 16px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; background: #059669; border: 1px solid #047857; border-radius: 6px; color: white;">
                <span>↗️</span> Buka Layar Penuh (Tab Baru)
              </button>
              <button type="button" class="btn-sec" onclick="downloadArsipFile('${a.id}')" style="padding: 7px 14px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 6px;">
                <span>⬇️</span> Unduh File
              </button>
            </div>
          </div>

          <!-- EMBEDDED OBJECT & IFRAME MENGGUNAKAN BLOB URL -->
          <div style="width: 100%; height: 520px; background: #525659; position: relative;">
            <object data="${pdfBlobUrl}#toolbar=1" type="application/pdf" width="100%" height="100%" style="display: block; width: 100%; height: 100%;">
              <iframe src="${pdfBlobUrl}" width="100%" height="100%" style="border: none;">
                <div style="padding: 40px 20px; text-align: center; background: #F8FAFC; color: #475569; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <div style="font-size: 44px; margin-bottom: 12px;">📄</div>
                  <h4 style="font-size: 16px; color: #0F172A; margin-bottom: 8px; font-weight: 800;">Baca Dokumen PDF</h4>
                  <p style="font-size: 12.5px; color: #64748B; max-width: 440px; margin-bottom: 16px; line-height: 1.5;">
                    Jika tampilan pratinjau browser tidak muncul otomatis di dalam kotak ini, silakan klik tombol di bawah untuk membuka dan membaca dokumen secara penuh di tab baru.
                  </p>
                  <button type="button" class="btn-prim" onclick="openArsipPdfInNewTab('${a.id}')" style="padding: 9px 22px; font-size: 13px; font-weight: 700;">
                    <span>↗️</span> Buka & Baca Dokumen di Tab Baru
                  </button>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      ` : isImg ? `
        <div style="background: #0F172A; border-radius: 12px; padding: 14px; text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; color: #94A3B8; font-size: 12px; padding: 0 4px;">
            <span>🖼️ Pratinjau Foto Dokumen: <strong>${a.fileName}</strong></span>
            <button type="button" class="btn-prim" onclick="downloadArsipFile('${a.id}')" style="padding: 5px 12px; font-size: 11px;">
              <span>⬇️</span> Unduh Foto
            </button>
          </div>
          <img src="${a.fileBase64}" style="max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px;" alt="${a.nama}">
        </div>
      ` : a.fileUrl ? `
        <div style="background: #EFF6FF; border: 1.5px solid #93C5FD; border-radius: 12px; padding: 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 10px; background: #3B82F6; color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                🌐
              </div>
              <div>
                <div style="font-weight: 800; color: #1E40AF; font-size: 14px;">Tautan Dokumen Cloud / Google Drive</div>
                <div style="font-size: 12px; color: #2563EB; margin-top: 2px; word-break: break-all;">${a.fileUrl}</div>
              </div>
            </div>
            <a href="${a.fileUrl}" target="_blank" rel="noopener noreferrer" class="btn-prim" style="text-decoration: none; padding: 8px 18px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px;">
              <span>↗️</span> Buka di Google Drive
            </a>
          </div>
        </div>
      ` : `
        <div style="background: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 22px; text-align: center; color: #64748B;">
          <div style="font-size: 32px; margin-bottom: 6px;">📦</div>
          <div style="font-weight: 800; color: #334155; font-size: 13.5px;">Dokumen Diarsipkan Secara Fisik</div>
          <div style="font-size: 12px; margin-top: 4px;">Tidak ada lampiran file digital. Silakan ambil berkas fisik di: <strong style="color: #059669;">${a.lokasiFisik}</strong>.</div>
        </div>
      `}
    </div>
  `;

  if (leftActions) {
    leftActions.innerHTML = `
      <button type="button" class="btn-sec" onclick="printArsip(${a.id})" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; cursor: pointer;">
        <span>🖨️</span> Cetak Lembar Arsip
      </button>
    `;
  }

  if (actions) {
    actions.innerHTML = `
      <button type="button" class="btn-prim" onclick="closeModal('modal-view-arsip'); openEditArsip(${a.id})" style="display: inline-flex; align-items: center; gap: 6px;">
        <span>✏️</span> Edit Data
      </button>
      <button type="button" class="btn-sec" onclick="closeModal('modal-view-arsip')">Tutup Jendela</button>
    `;
  }

  document.getElementById('modal-view-arsip').classList.add('open');
}

function printArsip(id) {
  const list = getArsipList();
  const a = list.find(x => x.id === id);
  if (!a) return;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showToast('Izinkan pop-up browser untuk mencetak lembar arsip!', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Lembar Kendali Arsip - ${a.nama}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; margin: 0; }
        .header { text-align: center; border-bottom: 2.5px double #0f172a; padding-bottom: 14px; margin-bottom: 24px; }
        .header h2 { margin: 0; font-size: 18px; color: #047857; text-transform: uppercase; letter-spacing: 1px; }
        .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
        .title-box { background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #059669; }
        .title-box h3 { margin: 0; font-size: 16px; color: #0f172a; }
        .title-box span { font-size: 12px; color: #64748b; display: block; margin-top: 4px; }
        .loc-box { background: #ecfdf5; border: 1.5px solid #86efac; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
        .loc-box strong { font-size: 16px; color: #065f46; display: block; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th, td { padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; }
        th { background: #f8fafc; width: 32%; font-weight: 700; color: #334155; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>YAYASAN LENTERA HATI GURINDAM</h2>
        <p>Pusat Administrasi & Arsip Dokumen Resmi Organisasi Kota Tanjungpinang</p>
      </div>

      <div class="title-box">
        <h3>${a.nama}</h3>
        <span>Nomor Dokumen: <strong>${a.nomor || 'Tanpa Nomor Resmi'}</strong></span>
      </div>

      <div class="loc-box">
        <span style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">LOKASI FISIK PENYIMPANAN DI KANTOR:</span>
        <strong>📍 ${a.lokasiFisik}</strong>
      </div>

      <table>
        <tr>
          <th>Kategori Klasifikasi</th>
          <td><strong>${a.kategori}</strong></td>
        </tr>
        <tr>
          <th>Nomor / Kode Resmi</th>
          <td>${a.nomor || '-'}</td>
        </tr>
        <tr>
          <th>Tanggal Dokumen</th>
          <td>${a.tanggal ? formatDate(a.tanggal) : '-'}</td>
        </tr>
        <tr>
          <th>Instansi / Lembaga Penerbit</th>
          <td>${a.penerbit || '-'}</td>
        </tr>
        <tr>
          <th>Petugas Pencatat</th>
          <td>${a.uploadedBy || 'Pengurus Yayasan'}</td>
        </tr>
        <tr>
          <th>Ketersediaan Lampiran Digital</th>
          <td>${a.fileBase64 ? 'Tersimpan File Digital (' + (a.fileName || 'PDF/Gambar') + ')' : a.fileUrl ? 'Tautan Cloud (' + a.fileUrl + ')' : 'Hanya Arsip Fisik'}</td>
        </tr>
        <tr>
          <th>Uraian & Ringkasan Dokumen</th>
          <td>${a.keterangan || '-'}</td>
        </tr>
      </table>

      <div class="footer">
        <div>
          <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
          <p>Petugas Administrasi Arsip</p>
        </div>
        <div style="text-align: right; width: 200px;">
          <p>Mengetahui,</p>
          <br><br><br>
          <p style="font-weight: 700; border-top: 1px solid #94a3b8; padding-top: 4px; margin: 0;">KAMARIDA</p>
          <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Superadmin Yayasan LHG</p>
        </div>
      </div>

      <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 24px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">🖨️ Cetak Lembar Dokumen Ini</button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// TOAST NOTIFICATIONS
function showToast(msg, type) {
  type = type || 'success';
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span>${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ================= MODERN CONFIRM & DIALOG SYSTEM =================
let _lhgConfirmResolver = null;

function showModernConfirm({
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  subtext = '',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'danger',
  icon = 'logout'
} = {}) {
  return new Promise((resolve) => {
    _lhgConfirmResolver = resolve;

    const overlay = document.getElementById('lhg-confirm-dialog');
    if (!overlay) {
      resolve(window.confirm ? window.confirm(message) : true);
      return;
    }

    const titleEl = document.getElementById('lhg-confirm-title');
    const descEl = document.getElementById('lhg-confirm-desc');
    const subtextEl = document.getElementById('lhg-confirm-subtext');
    const confirmBtnText = document.getElementById('lhg-confirm-btn-text');
    const confirmBtnIcon = document.getElementById('lhg-confirm-btn-icon');
    const cancelBtn = document.getElementById('lhg-confirm-btn-cancel');
    const iconInner = document.getElementById('lhg-confirm-icon');

    // Reset themes
    overlay.className = 'lhg-confirm-overlay lhg-confirm-theme-' + (type || 'primary');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = message;

    if (subtextEl) {
      if (subtext) {
        subtextEl.innerHTML = subtext;
        subtextEl.style.display = 'inline-block';
      } else {
        subtextEl.style.display = 'none';
        subtextEl.innerHTML = '';
      }
    }

    if (confirmBtnText) confirmBtnText.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;

    // SVG icons definitions
    const ICONS = {
      logout: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
      delete: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
      warning: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      question: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      success: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      info: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const BTN_ICONS = {
      logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
      delete: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };

    if (iconInner) {
      iconInner.innerHTML = ICONS[icon] || ICONS.question;
    }

    if (confirmBtnIcon) {
      confirmBtnIcon.innerHTML = BTN_ICONS[icon] || '';
    }

    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.classList.add('show');

    if (cancelBtn) {
      cancelBtn.focus();
    }
  });
}

function lhgConfirmOk() {
  closeModernConfirm(true);
}

function lhgConfirmCancel() {
  closeModernConfirm(false);
}

function closeModernConfirm(result) {
  const overlay = document.getElementById('lhg-confirm-dialog');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.style.display = 'none';
    if (_lhgConfirmResolver) {
      _lhgConfirmResolver(result);
      _lhgConfirmResolver = null;
    }
  }, 220);
}

// Global keyboard shortcut for confirmation dialog
document.addEventListener('keydown', (e) => {
  const overlay = document.getElementById('lhg-confirm-dialog');
  if (overlay && overlay.classList.contains('show')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      lhgConfirmCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      lhgConfirmOk();
    }
  }
});

// ================= MENU FORMULIR INPUT DATA ANAK (MANDIRI) =================
function initDirectInputPage() {
  // Dedicated page initialization
}

function handleDirectDisabilityChange(val) {
  const subInput = document.getElementById('direct-subDisabilitas');
  if (!subInput) return;
  const suggestions = {
    'Tuna Rungu': 'Tunarungu Wicara',
    'Tuna Netra': 'Low Vision',
    'Tuna Grahita': 'Hambatan Intelektual Ringan',
    'Autis': 'Spektrum Autisme',
    'Down Syndrome': 'Trisomi 21',
    'Disabilitas Berat': 'Disabilitas Ganda',
    'Tuna Daksa Kursi Roda': 'Kelemahan Motorik Bawah',
    'Tuna Daksa Tongkat': 'Kelemahan Kaki Kiri/Kanan',
    'Tuna Daksa Kaku': 'Cerebral Palsy Spastik',
    'Tuna Daksa Tanpa Tangan': 'Ketiadaan Anggota Gerak Atas'
  };
  if (suggestions[val] && !subInput.value) {
    subInput.value = suggestions[val];
  }
}

function resetDirectInputForm() {
  const form = document.getElementById('form-direct-input-anak');
  if (form) form.reset();
  showToast('Formulir telah dikosongkan.', 'info');
}

async function saveDirectInputAnak(e) {
  if (e) e.preventDefault();
  const nama = document.getElementById('direct-nama').value.trim();
  const nik = document.getElementById('direct-nik').value.trim();
  const noKk = document.getElementById('direct-noKk').value.trim();
  const ttl = document.getElementById('direct-ttl').value.trim();
  const jk = document.getElementById('direct-jk').value;
  const kontakWA = document.getElementById('direct-kontakWA').value.trim();
  const disabilitas = document.getElementById('direct-disabilitas').value;
  const subDisabilitas = document.getElementById('direct-subDisabilitas').value.trim();
  const status = document.getElementById('direct-status').value;
  const sekolah = document.getElementById('direct-sekolah').value.trim();
  const kelas = document.getElementById('direct-kelas').value.trim();
  const alamat = document.getElementById('direct-alamat').value.trim();
  const kelurahan = document.getElementById('direct-kelurahan').value.trim();
  const wali = document.getElementById('direct-wali').value.trim();
  const ibu = document.getElementById('direct-ibu').value.trim();
  const hubWali = document.getElementById('direct-hubWali').value;

  if (!nama || !nik || !disabilitas) {
    showToast('Harap lengkapi field wajib: Nama, NIK, dan Ragam Disabilitas!', 'error');
    return;
  }

  const anggota = DB.get('lhg_anggota', []);
  const no = 'LHG-' + String(anggota.length + 1).padStart(3, '0');

  const newChild = {
    id: no,
    noAnggota: no,
    nama: nama.toUpperCase(),
    nik: nik,
    noKk: noKk || '-',
    ttl: ttl || '-',
    jk: jk,
    kontakWA: kontakWA || '-',
    alamat: alamat || '-',
    kelurahan: kelurahan || '-',
    disabilitas: disabilitas,
    subDisabilitas: subDisabilitas || '-',
    wali: wali || '-',
    ibu: ibu || '-',
    hubWali: hubWali,
    telWali: kontakWA || '-',
    sekolah: sekolah || '-',
    kelas: kelas || '-',
    status: status,
    umur: '12 Thn',
    tglDaftar: new Date().toISOString().split('T')[0],
    foto: null
  };

  anggota.unshift(newChild);
  DB.set('lhg_anggota', anggota);

  // Update badge & refresh tables
  setText('nav-badge-anak', anggota.length);
  setText('bottom-badge-anak', anggota.length);
  renderAnggotaTable();
  renderDashboard();
  if (typeof renderCetakKTA === 'function') renderCetakKTA();
  if (typeof renderFormPendaftaranPage === 'function') renderFormPendaftaranPage(no);

  const form = document.getElementById('form-direct-input-anak');
  if (form) form.reset();

  showToast(`Data anak ${nama.toUpperCase()} (${no}) berhasil disimpan!`, 'success');

  // Modern confirmation to directly open PDF or go to table
  const viewPdf = await showModernConfirm({
    title: 'Pendaftaran Berhasil!',
    message: `Data anak ${nama.toUpperCase()} berhasil disimpan di sistem.`,
    subtext: 'Apakah Anda ingin langsung melihat & mencetak Surat Keterangan Pendaftaran (PDF)?',
    confirmText: 'Buka Surat PDF',
    cancelText: 'Kembali ke Data',
    type: 'primary',
    icon: 'success'
  });

  if (viewPdf) {
    openSuratFor(no);
  } else {
    navigate('input-data');
  }
}

// ================= MENU MANAJEMEN USER (KHUSUS SUPERADMIN) =================
let userEditTarget = null;

function renderManajemenUserTable(search, filterRole) {
  search = (search || '').toLowerCase().trim();
  filterRole = filterRole || (document.getElementById('user-filter-role') ? document.getElementById('user-filter-role').value : '');

  let users = DB.get('lhg_users', []);
  if (search) {
    users = users.filter(u => 
      (u.username && u.username.toLowerCase().includes(search)) ||
      (u.nama && u.nama.toLowerCase().includes(search))
    );
  }
  if (filterRole) {
    users = users.filter(u => u.role === filterRole);
  }

  const tbody = document.getElementById('user-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #64748B;">
          <div style="font-size: 32px; margin-bottom: 8px;">👤</div>
          <p>Tidak ada pengguna yang cocok dengan kriteria</p>
        </td>
      </tr>
    `;
    return;
  }

  const currentUser = getAuthUser();

  tbody.innerHTML = users.map((u, i) => {
    const roleBadgeClass = u.role === 'Superadmin' ? 'badge-role-superadmin' : (u.role === 'Admin' ? 'badge-role-admin' : 'badge-role-petugas');
    const isSelf = currentUser && currentUser.username === u.username;

    return `
      <tr>
        <td style="text-align: center; font-weight: 700; color: #64748B;">${i + 1}</td>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: #0F172A; font-size: 13px;">${u.username}</span>
          ${isSelf ? '<span style="margin-left: 6px; font-size: 10px; background: #ECFDF5; color: #059669; padding: 2px 6px; border-radius: 10px; font-weight: 800;">Akun Anda</span>' : ''}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #F1F5F9; color: #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">
              ${getInitials(u.nama || u.username)}
            </div>
            <strong style="color: #0F172A;">${u.nama || '-'}</strong>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="${roleBadgeClass}">${u.role}</span>
        </td>
        <td style="text-align: center;">
          <span class="${u.status === 'Aktif' ? 'badge-status-aktif' : 'badge-status-tidak-aktif'}">${u.status}</span>
        </td>
        <td style="font-size: 12px; color: #64748B;">${u.createdAt || '-'}</td>
        <td style="text-align: center;">
          <div class="action-buttons-group">
            <button class="btn-action-icon" onclick="openEditUser('${u.username}')" title="Edit Pengguna">✏️</button>
            ${!isSelf && u.username !== '2172041908850002' ? `
              <button class="btn-action-icon danger" onclick="deleteUser('${u.username}')" title="Hapus Pengguna">🗑️</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsersByRole(role) {
  const search = document.getElementById('user-search-input') ? document.getElementById('user-search-input').value : '';
  renderManajemenUserTable(search, role);
}

function openAddUser() {
  userEditTarget = null;
  setText('modal-user-title', 'Tambah Pengguna Baru');
  document.getElementById('user-edit-username').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-username').disabled = false;
  document.getElementById('user-nama').value = '';
  document.getElementById('user-role').value = 'Petugas';
  document.getElementById('user-status').value = 'Aktif';
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').required = true;
  document.getElementById('user-password').placeholder = 'Masukkan Kata Sandi';
  setText('user-password-hint', 'Kata sandi minimal 6 karakter.');
  document.getElementById('modal-user').classList.add('open');
}

function openEditUser(username) {
  const users = DB.get('lhg_users', []);
  const u = users.find(x => x.username === username);
  if (!u) return;

  userEditTarget = username;
  setText('modal-user-title', `Edit Pengguna: ${u.nama || u.username}`);
  document.getElementById('user-edit-username').value = username;
  document.getElementById('user-username').value = u.username;
  document.getElementById('user-username').disabled = true;
  document.getElementById('user-nama').value = u.nama || '';
  document.getElementById('user-role').value = u.role;
  document.getElementById('user-status').value = u.status;
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').required = false;
  document.getElementById('user-password').placeholder = 'Kosongkan jika tidak ingin mengubah kata sandi';
  setText('user-password-hint', 'Kosongkan jika password tetap sama.');
  document.getElementById('modal-user').classList.add('open');
}

function saveUser() {
  const usernameInput = document.getElementById('user-username');
  const nama = document.getElementById('user-nama').value.trim();
  const role = document.getElementById('user-role').value;
  const status = document.getElementById('user-status').value;
  const password = document.getElementById('user-password').value.trim();
  const isEditing = Boolean(userEditTarget);

  const username = isEditing ? userEditTarget : usernameInput.value.trim();

  if (!username || !nama) {
    showToast('Username dan Nama Lengkap wajib diisi!', 'error');
    return;
  }

  const users = DB.get('lhg_users', []);

  if (isEditing) {
    removeDeletedUser(username);
    const idx = users.findIndex(x => x.username === userEditTarget);
    if (idx > -1) {
      users[idx].nama = nama;
      users[idx].role = role;
      users[idx].status = status;
      if (password) {
        users[idx].password = password;
      }
      DB.set('lhg_users', users);

      // If updating current user's profile
      const currentUser = getAuthUser();
      if (currentUser && currentUser.username === userEditTarget) {
        currentUser.nama = nama;
        currentUser.role = role;
        currentUser.status = status;
        localStorage.setItem('lhg_auth_user', JSON.stringify(currentUser));
        applyRoleUI(currentUser);
      }

      showToast(`Data pengguna ${username} berhasil diperbarui!`, 'success');
    }
  } else {
    // Check uniqueness
    if (users.some(x => x.username.toLowerCase() === username.toLowerCase())) {
      showToast(`Username ${username} sudah terdaftar, gunakan yang lain!`, 'error');
      return;
    }
    if (!password) {
      showToast('Kata sandi wajib diisi untuk pengguna baru!', 'error');
      return;
    }

    removeDeletedUser(username);
    users.push({
      username: username,
      password: password,
      nama: nama,
      role: role,
      status: status,
      createdAt: new Date().toISOString().split('T')[0]
    });
    DB.set('lhg_users', users);
    showToast(`Pengguna baru ${username} (${role}) berhasil ditambahkan!`, 'success');
  }

  closeModal('modal-user');
  renderManajemenUserTable();
}

async function deleteUser(username) {
  const currentUser = getAuthUser();
  if (currentUser && currentUser.username === username) {
    showToast('Anda tidak dapat menghapus akun Anda sendiri!', 'error');
    return;
  }
  if (username === '2172041908850002') {
    showToast('Akun Superadmin utama tidak dapat dihapus!', 'error');
    return;
  }
  const confirmed = await showModernConfirm({
    title: 'Hapus Akun Pengguna',
    message: `Hapus akun pengguna "${username}"?`,
    subtext: 'Akun ini akan dihapus permanen dan tidak dapat login ke aplikasi lagi.',
    confirmText: 'Ya, Hapus Akun',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;

  // 1. Simpan ke daftar akun terhapus (tombstone) agar tidak pernah muncul lagi
  addDeletedUser(username);

  // 2. Hapus dari database lokal
  const users = DB.get('lhg_users', []).filter(x => x.username !== username);
  localStorage.setItem('lhg_users', JSON.stringify(users));

  // 3. Hapus langsung dari Supabase Cloud agar tidak kembali saat refresh atau sync
  try {
    await SupabaseAPI.delete('lhg_users', 'username', username);
  } catch (e) {
    console.warn('Gagal menghapus user dari Supabase:', e);
  }

  // 4. Perbarui tampilan tabel pengguna
  renderManajemenUserTable();
  showToast(`Pengguna ${username} berhasil dihapus secara permanen!`, 'warning');
}

// ==============================================================================
// MENU BANTUAN ANAK (CATATAN SEMUA BANTUAN YANG TELAH DITERIMA)
// ==============================================================================

function getBantuanList() {
  return DB.get('lhg_bantuan', []);
}

function renderBantuanPage() {
  populateBantuanAnakSelect();
  renderBantuanStats();
  renderBantuanTable();
}

function renderBantuanStats() {
  const list = getBantuanList();
  const total = list.length;
  const uniqueAnak = new Set(list.map(b => b.anakId || b.anakNama)).size;
  const alatBantu = list.filter(b => b.kategori === 'Alat Bantu').length;
  const sembako = list.filter(b => b.kategori === 'Sembako & Nutrisi').length;

  setText('stat-bantuan-total', total);
  setText('stat-bantuan-anak-count', uniqueAnak);
  setText('stat-bantuan-alat', alatBantu);
  setText('stat-bantuan-sembako', sembako);
  setText('nav-badge-bantuan', total);
  setText('bottom-badge-bantuan', total);
}

let activeBantuanKategori = '';

function filterBantuanByKategori(kat) {
  activeBantuanKategori = kat;
  const search = (document.getElementById('bantuan-search-input') || {}).value || '';
  renderBantuanTable(search);
}

function renderBantuanTable(search) {
  search = (search || '').toLowerCase().trim();
  let list = getBantuanList();

  if (activeBantuanKategori) {
    list = list.filter(b => b.kategori === activeBantuanKategori);
  }

  if (search) {
    list = list.filter(b => {
      const nama = (b.anakNama || '').toLowerCase();
      const bantuan = (b.namaBantuan || '').toLowerCase();
      const sumber = (b.sumber || '').toLowerCase();
      const petugas = (b.petugas || '').toLowerCase();
      const dis = (b.anakDisabilitas || '').toLowerCase();
      return nama.includes(search) || bantuan.includes(search) || sumber.includes(search) || petugas.includes(search) || dis.includes(search);
    });
  }

  // Sort by date descending (terbaru di atas)
  list.sort((a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0));

  const tbody = document.getElementById('bantuan-tbody');
  const cardList = document.getElementById('bantuan-card-list');

  if (list.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 38px; margin-bottom: 8px;">🎁</div>
            <p style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Belum Ada Catatan Bantuan</p>
            <p style="font-size: 12px;">Klik tombol "Catat Bantuan Baru" di atas untuk merekam bantuan yang diserahkan kepada anak.</p>
          </td>
        </tr>
      `;
    }
    if (cardList) {
      cardList.innerHTML = `
        <div class="mobile-empty-card">
          <div style="font-size: 38px; margin-bottom: 8px;">🎁</div>
          <div style="font-weight: 800; color: #1E293B; font-size: 14.5px;">Belum Ada Catatan Bantuan</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 4px; line-height: 1.5;">Belum ada penyaluran bantuan yang tercatat sesuai filter atau pencarian Anda.</div>
          <button type="button" class="btn-top-add" style="margin-top: 14px; width: 100%; justify-content: center;" onclick="openAddBantuan()">
            ➕ Catat Bantuan Baru
          </button>
        </div>
      `;
    }
    return;
  }

  const badgeKategoriMap = {
    'Alat Bantu': { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D', icon: '🦯' },
    'Sembako & Nutrisi': { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE', icon: '📦' },
    'Santunan / Uang Tunai': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', icon: '💵' },
    'Pendidikan & Sekolah': { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', icon: '🎒' },
    'Kesehatan & Obat': { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA', icon: '💊' },
    'Lainnya': { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: '🎁' }
  };

  // Render desktop table
  if (tbody) {
    tbody.innerHTML = list.map((b, idx) => {
      const katStyle = badgeKategoriMap[b.kategori] || badgeKategoriMap['Lainnya'];
      return `
        <tr>
          <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
          <td style="white-space: nowrap;">
            <span style="font-weight: 700; color: #1E293B; font-size: 13px;">📅 ${formatDate(b.tanggal)}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="table-avatar">${getInitials(b.anakNama)}</div>
              <div>
                <div style="font-weight: 800; font-size: 13px; color: #0F172A;">${b.anakNama}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${b.anakDisabilitas || '-'} • NIK: ${b.anakNik || '-'}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: #047857; font-size: 13.5px;">${b.namaBantuan}</div>
            ${b.jumlah ? `<span style="font-size: 11px; color: #64748B; font-weight: 600;">Jumlah: ${b.jumlah}</span>` : ''}
            ${b.keterangan ? `<div style="font-size: 11.5px; color: #475569; margin-top: 3px; font-style: italic;">"${b.keterangan}"</div>` : ''}
          </td>
          <td>
            <span style="background: ${katStyle.bg}; color: ${katStyle.color}; border: 1px solid ${katStyle.border}; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
              ${katStyle.icon} ${b.kategori}
            </span>
          </td>
          <td>
            <span style="font-weight: 600; font-size: 12.5px; color: #334155;">${b.sumber || '-'}</span>
          </td>
          <td>
            <span style="font-size: 12px; color: #475569;">👤 ${b.petugas || '-'}</span>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn-action-icon" onclick="openDetailBantuan(${b.id})" title="Lihat Detail Bantuan">👁️</button>
              <button class="btn-action-icon edit" onclick="openEditBantuan(${b.id})" title="Edit Catatan Bantuan">✏️</button>
              <button class="btn-action-icon delete" onclick="deleteBantuan(${b.id})" title="Hapus Catatan Bantuan">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render mobile cards (Card View)
  if (cardList) {
    cardList.innerHTML = list.map((b) => {
      const katStyle = badgeKategoriMap[b.kategori] || badgeKategoriMap['Lainnya'];
      return `
        <div class="data-record-card" onclick="openDetailBantuan(${b.id})" title="Ketuk untuk melihat detail bantuan">
          <div class="d-card-header">
            <div class="d-card-avatar-wrap">
              <div class="d-card-avatar">${getInitials(b.anakNama)}</div>
            </div>
            <div class="d-card-main-info">
              <div class="d-card-title-row">
                <h4 class="d-card-name">${b.anakNama}</h4>
                <span style="background: ${katStyle.bg}; color: ${katStyle.color}; border: 1px solid ${katStyle.border}; padding: 2px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                  ${katStyle.icon} ${b.kategori}
                </span>
              </div>
              <div class="d-card-sub-row">
                <span style="font-weight: 800; color: #047857; font-size: 13px;">🎁 ${b.namaBantuan}</span>
                ${b.jumlah ? `<span style="font-size: 11px; color: #64748B;">• ${b.jumlah}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="d-card-tags">
            <span class="d-card-tag-pill">📅 ${formatDate(b.tanggal)}</span>
            <span class="d-card-tag-pill">🏛️ ${b.sumber || 'Kas Yayasan'}</span>
            ${b.petugas ? `<span class="d-card-tag-pill">👤 ${b.petugas}</span>` : ''}
          </div>

          ${b.keterangan ? `
            <div style="font-size: 11.5px; color: #475569; background: #F8FAFC; border-radius: 8px; padding: 7px 10px; margin-bottom: 8px; font-style: italic;">
              "${b.keterangan}"
            </div>
          ` : ''}

          <div class="d-card-footer">
            <div class="d-card-parent-info">
              <span>Disabilitas: <strong>${b.anakDisabilitas || '-'}</strong></span>
            </div>
            <div class="d-card-actions" onclick="event.stopPropagation();">
              <button type="button" class="btn-action-icon" onclick="openDetailBantuan(${b.id})" title="Lihat Detail Bantuan">👁️</button>
              <button type="button" class="btn-action-icon" onclick="openEditBantuan(${b.id})" title="Edit Catatan Bantuan">✏️</button>
              <button type="button" class="btn-action-icon danger" onclick="deleteBantuan(${b.id})" title="Hapus Catatan Bantuan">🗑️</button>
            </div>
          </div>

          <div class="d-card-tap-cue">
            <span>👆 Ketuk kartu untuk rincian data penyerahan bantuan</span>
            <span class="d-card-tap-arrow">›</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function openDetailBantuan(id) {
  const b = getBantuanList().find(x => x.id === id);
  if (!b) return;

  const badgeKategoriMap = {
    'Alat Bantu': { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D', icon: '🦯' },
    'Sembako & Nutrisi': { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE', icon: '📦' },
    'Santunan / Uang Tunai': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', icon: '💵' },
    'Pendidikan & Sekolah': { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', icon: '🎒' },
    'Kesehatan & Obat': { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA', icon: '💊' },
    'Lainnya': { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: '🎁' }
  };
  const katStyle = badgeKategoriMap[b.kategori] || badgeKategoriMap['Lainnya'];

  const rows = [
    ['Nama Penerima (Anak)', `${b.anakNama} (${b.anakDisabilitas || '-'})`],
    ['NIK Penerima', b.anakNik || '-'],
    ['Tanggal Penyerahan', formatDate(b.tanggal)],
    ['Kategori Bantuan', `<span style="background:${katStyle.bg}; color:${katStyle.color}; border:1px solid ${katStyle.border}; padding:2px 8px; border-radius:12px; font-weight:700; font-size:11px;">${katStyle.icon} ${b.kategori}</span>`],
    ['Nama / Item Bantuan', b.namaBantuan],
    ['Volume / Jumlah', b.jumlah || '-'],
    ['Sumber / Pemberi Bantuan', b.sumber || '-'],
    ['Petugas Penyerah', b.petugas || '-'],
    ['Keterangan / Catatan', b.keterangan || '-']
  ];

  const contentEl = document.getElementById('view-bantuan-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #E2E8F0;">
        <div class="d-card-avatar" style="width: 48px; height: 48px; font-size: 16px;">${getInitials(b.anakNama)}</div>
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: #0F172A; text-transform: uppercase;">${b.anakNama}</h3>
          <div style="font-size: 13px; color: #047857; font-weight: 700; margin-top: 2px;">🎁 ${b.namaBantuan}</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
        ${rows.map(([k, v]) => `
          <div style="background: #F8FAFC; padding: 9px 12px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <div style="font-size: 10px; color: #64748B; font-weight: 700;">${k}</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #1E293B; margin-top: 2px;">${v || '-'}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const btnEdit = document.getElementById('modal-view-bantuan-btn-edit');
  if (btnEdit) {
    btnEdit.style.display = 'inline-flex';
    btnEdit.onclick = () => {
      closeModal('modal-view-bantuan');
      openEditBantuan(b.id);
    };
  }

  const modal = document.getElementById('modal-view-bantuan');
  if (modal) modal.classList.add('open');
}

function populateBantuanAnakSelect() {
  const sel = document.getElementById('bantuan-select-anak');
  if (!sel) return;
  const anggota = DB.get('lhg_anggota', []);
  
  let opts = '<option value="">-- Pilih Anak Terdaftar di Database --</option>';
  anggota.forEach(a => {
    opts += `<option value="${a.id}">${a.nama} (${a.disabilitas} - ${a.id})</option>`;
  });
  sel.innerHTML = opts;
}

function onBantuanAnakChange(anakId) {
  const box = document.getElementById('bantuan-anak-preview-box');
  const info = document.getElementById('bantuan-anak-preview-info');
  if (!anakId) {
    if (box) box.style.display = 'none';
    return;
  }
  const anggota = DB.get('lhg_anggota', []);
  const anak = anggota.find(a => a.id === anakId);
  if (anak && box && info) {
    box.style.display = 'block';
    info.innerHTML = `<strong>Data Anak:</strong> ${anak.nama} | NIK: ${anak.nik} | Ragam: <span style="color:#059669; font-weight:700;">${anak.disabilitas}</span> | Wali: ${anak.wali || '-'} (${anak.kontakWA || '-'})`;
  }
}

function openAddBantuan() {
  populateBantuanAnakSelect();
  setText('modal-bantuan-title', 'Catat Penyerahan Bantuan Anak');
  document.getElementById('bantuan-edit-id').value = '';
  document.getElementById('form-bantuan').reset();

  const box = document.getElementById('bantuan-anak-preview-box');
  if (box) box.style.display = 'none';

  // Set default tanggal hari ini
  const today = new Date().toISOString().split('T')[0];
  const tglInput = document.getElementById('bantuan-tanggal');
  if (tglInput) tglInput.value = today;

  // Set default nama petugas dari user yang sedang login
  const curUser = getAuthUser();
  const petInput = document.getElementById('bantuan-petugas');
  if (petInput && curUser) {
    petInput.value = curUser.nama || curUser.username;
  }

  document.getElementById('modal-bantuan').classList.add('open');
}

function openEditBantuan(id) {
  populateBantuanAnakSelect();
  const list = getBantuanList();
  const b = list.find(x => x.id === id);
  if (!b) return;

  setText('modal-bantuan-title', 'Edit Catatan Penyerahan Bantuan');
  document.getElementById('bantuan-edit-id').value = b.id;

  const selAnak = document.getElementById('bantuan-select-anak');
  if (selAnak) selAnak.value = b.anakId;
  onBantuanAnakChange(b.anakId);

  document.getElementById('bantuan-nama').value = b.namaBantuan || '';
  document.getElementById('bantuan-kategori').value = b.kategori || 'Alat Bantu';
  document.getElementById('bantuan-tanggal').value = b.tanggal || '';
  document.getElementById('bantuan-jumlah').value = b.jumlah || '';
  document.getElementById('bantuan-petugas').value = b.petugas || '';
  document.getElementById('bantuan-sumber').value = b.sumber || '';
  document.getElementById('bantuan-keterangan').value = b.keterangan || '';

  document.getElementById('modal-bantuan').classList.add('open');
}

function saveBantuan() {
  const editId = document.getElementById('bantuan-edit-id').value;
  const selAnak = document.getElementById('bantuan-select-anak');
  const anakId = selAnak.value;
  if (!anakId) {
    showToast('Harap pilih data anak penerima bantuan!', 'error');
    return;
  }

  const anggota = DB.get('lhg_anggota', []);
  const anak = anggota.find(a => a.id === anakId) || {};

  const namaBantuan = document.getElementById('bantuan-nama').value.trim();
  const kategori = document.getElementById('bantuan-kategori').value;
  const tanggal = document.getElementById('bantuan-tanggal').value;
  const jumlah = document.getElementById('bantuan-jumlah').value.trim();
  const petugas = document.getElementById('bantuan-petugas').value.trim();
  const sumber = document.getElementById('bantuan-sumber').value.trim();
  const keterangan = document.getElementById('bantuan-keterangan').value.trim();

  if (!namaBantuan || !tanggal) {
    showToast('Harap isi bantuan yang diberikan dan tanggal penyerahan!', 'error');
    return;
  }

  let list = getBantuanList();

  if (editId) {
    const idx = list.findIndex(x => x.id === parseInt(editId));
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        anakId: anakId,
        anakNama: anak.nama || list[idx].anakNama,
        anakNik: anak.nik || list[idx].anakNik,
        anakDisabilitas: anak.disabilitas || list[idx].anakDisabilitas,
        namaBantuan: namaBantuan,
        kategori: kategori,
        tanggal: tanggal,
        jumlah: jumlah,
        petugas: petugas,
        sumber: sumber,
        keterangan: keterangan
      };
      DB.set('lhg_bantuan', list);
      showToast('Catatan bantuan berhasil diperbarui!', 'success');
    }
  } else {
    const newRecord = {
      id: Date.now(),
      anakId: anakId,
      anakNama: anak.nama || 'Anak Disabilitas',
      anakNik: anak.nik || '-',
      anakDisabilitas: anak.disabilitas || '-',
      namaBantuan: namaBantuan,
      kategori: kategori,
      tanggal: tanggal,
      jumlah: jumlah,
      petugas: petugas || (getAuthUser() ? getAuthUser().nama : 'Petugas LHG'),
      sumber: sumber,
      keterangan: keterangan
    };
    list.unshift(newRecord);
    DB.set('lhg_bantuan', list);
    showToast(`Bantuan untuk ${anak.nama} berhasil dicatat!`, 'success');
  }

  closeModal('modal-bantuan');
  renderBantuanStats();
  renderBantuanTable();
}

async function deleteBantuan(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Catatan Bantuan',
    message: 'Apakah Anda yakin ingin menghapus catatan bantuan ini?',
    subtext: 'Catatan penyaluran bantuan akan dihapus dari sistem.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  let list = getBantuanList().filter(x => x.id !== id);
  localStorage.setItem('lhg_bantuan', JSON.stringify(list));
  try {
    await SupabaseAPI.delete('lhg_bantuan', 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus bantuan dari cloud:', e);
  }
  renderBantuanStats();
  renderBantuanTable();
  showToast('Catatan bantuan telah dihapus.', 'warning');
}

// ==============================================================================
// RENCANA KEGIATAN & PROGRAM KERJA YAYASAN LOGIC
// ==============================================================================

function getRencanaKegiatanList() {
  return DB.get('lhg_rencana_kegiatan', []);
}

function updateRencanaBadges() {
  const list = getRencanaKegiatanList();
  setText('nav-badge-rencana', list.length);
}

function formatRupiahDisplay(amount) {
  if (!amount && amount !== 0) return '-';
  const num = parseInt(String(amount).replace(/[^0-9]/g, '')) || 0;
  if (num === 0) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatRencanaBiayaInput(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (!val) {
    input.value = '';
    return;
  }
  input.value = 'Rp ' + parseInt(val, 10).toLocaleString('id-ID');
}

function getRencanaStatusBadge(status) {
  const map = {
    'Draf / Pengajuan': 'background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1;',
    'Menunggu Persetujuan': 'background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A;',
    'Disetujui': 'background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;',
    'Dalam Persiapan': 'background: #FDF4FF; color: #A21CAF; border: 1px solid #F5D0FE;',
    'Sedang Berjalan': 'background: #EDE9FE; color: #6D28D9; border: 1px solid #DDD6FE;',
    'Terlaksana': 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;',
    'Ditunda / Dibatalkan': 'background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA;'
  };
  const style = map[status] || 'background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1;';
  return `<span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${style}">${status}</span>`;
}

function getRencanaPrioritasBadge(p) {
  const map = {
    'Tinggi': 'background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5;',
    'Sedang': 'background: #FFFBEB; color: #D97706; border: 1px solid #FCD34D;',
    'Rendah': 'background: #F0FDF4; color: #16A34A; border: 1px solid #86EFAC;'
  };
  const style = map[p] || 'background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1;';
  return `<span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 800; ${style}">${p}</span>`;
}

function renderRencanaKegiatanPage() {
  const list = getRencanaKegiatanList();
  updateRencanaBadges();

  const total = list.length;
  const draf = list.filter(r => r.status === 'Draf / Pengajuan' || r.status === 'Menunggu Persetujuan').length;
  const disetujui = list.filter(r => ['Disetujui', 'Dalam Persiapan', 'Sedang Berjalan', 'Terlaksana'].includes(r.status)).length;
  
  let totalAnggaran = 0;
  list.forEach(r => {
    const raw = String(r.estimasiBiaya || '').replace(/[^0-9]/g, '');
    if (raw) totalAnggaran += parseInt(raw, 10);
  });

  setText('stat-rencana-total', total);
  setText('stat-rencana-draf', draf);
  setText('stat-rencana-disetujui', disetujui);
  setText('stat-rencana-anggaran', formatRupiahDisplay(totalAnggaran));

  renderRencanaKegiatanTable();
}

function filterRencanaKegiatan() {
  renderRencanaKegiatanTable();
}

function renderRencanaKegiatanTable() {
  const list = getRencanaKegiatanList();
  const tbody = document.getElementById('rencana-tbody');
  const cardList = document.getElementById('rencana-card-list');

  const q = (document.getElementById('rencana-search-input')?.value || '').toLowerCase().trim();
  const filterStatus = (document.getElementById('rencana-filter-status')?.value || '').trim();
  const filterKategori = (document.getElementById('rencana-filter-kategori')?.value || '').trim();

  const filtered = list.filter(item => {
    const matchQ = !q ||
      (item.judul && item.judul.toLowerCase().includes(q)) ||
      (item.penanggungJawab && item.penanggungJawab.toLowerCase().includes(q)) ||
      (item.targetPeserta && item.targetPeserta.toLowerCase().includes(q)) ||
      (item.lokasi && item.lokasi.toLowerCase().includes(q)) ||
      (item.sumberDana && item.sumberDana.toLowerCase().includes(q));

    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchKategori = !filterKategori || item.kategori === filterKategori;

    return matchQ && matchStatus && matchKategori;
  });

  if (filtered.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 36px 16px; color: #94A3B8;">
            <div style="font-size: 32px; margin-bottom: 6px;">📋</div>
            <div style="font-weight: 700; color: #475569; font-size: 13.5px;">Belum Ada Data Rencana Kegiatan</div>
            <p style="font-size: 12px; margin-top: 4px;">Klik tombol <strong>"Susun Rencana Baru"</strong> di atas untuk menyusun rencana kerja yayasan.</p>
          </td>
        </tr>
      `;
    }
    if (cardList) {
      cardList.innerHTML = `
        <div class="mobile-empty-card">
          <div style="font-size: 38px; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 800; color: #1E293B; font-size: 14.5px;">Belum Ada Rencana Kegiatan</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 4px; line-height: 1.5;">Belum ada agenda kerja yang sesuai filter atau pencarian Anda.</div>
          <button type="button" class="btn-top-add" style="margin-top: 14px; width: 100%; justify-content: center;" onclick="openAddRencanaKegiatan()">
            ➕ Susun Rencana Baru
          </button>
        </div>
      `;
    }
    return;
  }

  // Render desktop table
  if (tbody) {
    tbody.innerHTML = filtered.map((item, idx) => {
      let tglText = formatDate(item.tglMulai);
      if (item.tglSelesai && item.tglSelesai !== item.tglMulai) {
        tglText += ` s/d ${formatDate(item.tglSelesai)}`;
      }

      const biayaText = item.estimasiBiaya ? item.estimasiBiaya : 'Swadaya / Nihil';
      const sumberTag = item.sumberDana ? `<span style="font-size: 10px; color: #64748B; display: block; margin-top: 2px;">Dana: ${item.sumberDana}</span>` : '';

      return `
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748B;">${idx + 1}</td>
          <td>
            <div style="font-weight: 800; color: #0F172A; font-size: 13px; line-height: 1.35;">${item.judul}</div>
            <div style="font-size: 11px; color: #059669; font-weight: 600; margin-top: 3px;">🏷️ ${item.kategori}</div>
          </td>
          <td>
            <div style="font-size: 12px; font-weight: 600; color: #334155;">🎯 ${item.targetPeserta || '-'}</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 3px;">📍 ${item.lokasi || 'Sekretariat Yayasan'}</div>
          </td>
          <td style="font-size: 12px; color: #1E293B; white-space: nowrap;">
            <div style="font-weight: 600;">📅 ${tglText}</div>
          </td>
          <td>
            <div style="font-weight: 800; color: #2563EB; font-size: 12px;">${biayaText}</div>
            ${sumberTag}
          </td>
          <td>
            <div style="font-weight: 700; color: #0F172A; font-size: 12px;">👤 ${item.penanggungJawab || '-'}</div>
            <div style="font-size: 10.5px; color: #64748B; margin-top: 2px;">Penyusun: ${item.penyusun || '-'}</div>
          </td>
          <td style="text-align: center;">
            ${getRencanaPrioritasBadge(item.prioritas || 'Sedang')}
          </td>
          <td style="text-align: center;">
            ${getRencanaStatusBadge(item.status || 'Draf / Pengajuan')}
          </td>
          <td style="text-align: center;">
            <div class="action-buttons-group">
              <button class="btn-action-icon" style="color: #2563EB;" onclick="viewRencanaKegiatan(${item.id})" title="Lihat Detail Rencana">👁️</button>
              <button class="btn-action-icon" style="color: #059669;" onclick="printRencanaKegiatanDoc(${item.id})" title="Cetak Lembar Dokumen Resmi A4">🖨️</button>
              <button class="btn-action-icon" style="color: #D97706;" onclick="openEditRencanaKegiatan(${item.id})" title="Edit Rencana">✏️</button>
              <button class="btn-action-icon danger" onclick="deleteRencanaKegiatan(${item.id})" title="Hapus Rencana">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render mobile cards (Card View)
  if (cardList) {
    cardList.innerHTML = filtered.map((item) => {
      let tglText = formatDate(item.tglMulai);
      if (item.tglSelesai && item.tglSelesai !== item.tglMulai) {
        tglText += ` s/d ${formatDate(item.tglSelesai)}`;
      }
      const biayaText = item.estimasiBiaya ? item.estimasiBiaya : 'Swadaya / Nihil';

      return `
        <div class="data-record-card" onclick="viewRencanaKegiatan(${item.id})" title="Ketuk untuk melihat detail rencana kegiatan">
          <div class="d-card-header">
            <div class="d-card-avatar-wrap">
              <div class="d-card-avatar" style="background: #EFF6FF; color: #2563EB; border-color: #BFDBFE;">📋</div>
            </div>
            <div class="d-card-main-info">
              <div class="d-card-title-row">
                <h4 class="d-card-name" style="white-space: normal; line-height: 1.3;">${item.judul}</h4>
              </div>
              <div class="d-card-sub-row">
                <span style="color: #059669; font-weight: 700;">🏷️ ${item.kategori}</span>
              </div>
            </div>
          </div>

          <div class="d-card-tags">
            ${getRencanaStatusBadge(item.status || 'Draf / Pengajuan')}
            ${getRencanaPrioritasBadge(item.prioritas || 'Sedang')}
            <span class="d-card-tag-pill" style="font-weight: 700; color: #2563EB;">💰 ${biayaText}</span>
          </div>

          <div class="d-card-body-info">
            <div>📅 <strong>Jadwal:</strong> ${tglText}</div>
            <div>📍 <strong>Lokasi:</strong> ${item.lokasi || 'Sekretariat Yayasan'}</div>
          </div>

          <div class="d-card-footer">
            <div class="d-card-parent-info">
              <span>PIC: <strong>${item.penanggungJawab || '-'}</strong></span>
            </div>
            <div class="d-card-actions" onclick="event.stopPropagation();">
              <button type="button" class="btn-action-icon" style="color: #2563EB;" onclick="viewRencanaKegiatan(${item.id})" title="Detail Rencana">👁️</button>
              <button type="button" class="btn-action-icon" style="color: #059669;" onclick="printRencanaKegiatanDoc(${item.id})" title="Cetak Lembar Dokumen A4">🖨️</button>
              <button type="button" class="btn-action-icon" style="color: #D97706;" onclick="openEditRencanaKegiatan(${item.id})" title="Edit Rencana">✏️</button>
              <button type="button" class="btn-action-icon danger" onclick="deleteRencanaKegiatan(${item.id})" title="Hapus Rencana">🗑️</button>
            </div>
          </div>

          <div class="d-card-tap-cue">
            <span>👆 Ketuk kartu untuk melihat lembar rencana lengkap & cetak A4</span>
            <span class="d-card-tap-arrow">›</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function openAddRencanaKegiatan() {
  const f = document.getElementById('form-rencana-kegiatan');
  if (f) f.reset();
  
  const editIdEl = document.getElementById('rencana-edit-id');
  if (editIdEl) editIdEl.value = '';

  const titleEl = document.getElementById('modal-rencana-title');
  if (titleEl) titleEl.textContent = 'Susun Rencana Kegiatan Yayasan';

  const user = getAuthUser();
  const defaultName = user ? (user.nama || user.username) : 'Petugas LHG';
  
  const picEl = document.getElementById('rencana-pic');
  if (picEl) picEl.value = defaultName;

  const penyusunEl = document.getElementById('rencana-penyusun');
  if (penyusunEl) penyusunEl.value = defaultName;

  const tglMulaiEl = document.getElementById('rencana-tgl-mulai');
  if (tglMulaiEl) tglMulaiEl.value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('modal-rencana-kegiatan');
  if (modal) modal.classList.add('open');
}

function openEditRencanaKegiatan(id) {
  const item = getRencanaKegiatanList().find(x => x.id === id);
  if (!item) {
    showToast('Data rencana kegiatan tidak ditemukan!', 'error');
    return;
  }

  document.getElementById('rencana-edit-id').value = item.id;
  document.getElementById('rencana-judul').value = item.judul || '';
  document.getElementById('rencana-kategori').value = item.kategori || 'Pendidikan & Pelatihan';
  document.getElementById('rencana-prioritas').value = item.prioritas || 'Sedang';
  document.getElementById('rencana-target-peserta').value = item.targetPeserta || '';
  document.getElementById('rencana-pic').value = item.penanggungJawab || '';
  document.getElementById('rencana-tgl-mulai').value = item.tglMulai || '';
  document.getElementById('rencana-tgl-selesai').value = item.tglSelesai || '';
  document.getElementById('rencana-status').value = item.status || 'Draf / Pengajuan';
  document.getElementById('rencana-lokasi').value = item.lokasi || '';
  document.getElementById('rencana-biaya').value = item.estimasiBiaya || '';
  document.getElementById('rencana-sumber-dana').value = item.sumberDana || '';
  document.getElementById('rencana-penyusun').value = item.penyusun || '';
  document.getElementById('rencana-tujuan').value = item.tujuan || '';
  document.getElementById('rencana-deskripsi').value = item.deskripsi || '';

  const titleEl = document.getElementById('modal-rencana-title');
  if (titleEl) titleEl.textContent = 'Edit Rencana Kegiatan Yayasan';

  const modal = document.getElementById('modal-rencana-kegiatan');
  if (modal) modal.classList.add('open');
}

function saveRencanaKegiatan() {
  const judul = (document.getElementById('rencana-judul')?.value || '').trim();
  const kategori = document.getElementById('rencana-kategori')?.value;
  const prioritas = document.getElementById('rencana-prioritas')?.value || 'Sedang';
  const targetPeserta = (document.getElementById('rencana-target-peserta')?.value || '').trim();
  const pic = (document.getElementById('rencana-pic')?.value || '').trim();
  const tglMulai = document.getElementById('rencana-tgl-mulai')?.value;
  const tglSelesai = document.getElementById('rencana-tgl-selesai')?.value;
  const status = document.getElementById('rencana-status')?.value || 'Draf / Pengajuan';
  const lokasi = (document.getElementById('rencana-lokasi')?.value || '').trim();
  const estimasiBiaya = (document.getElementById('rencana-biaya')?.value || '').trim();
  const sumberDana = (document.getElementById('rencana-sumber-dana')?.value || '').trim();
  const penyusun = (document.getElementById('rencana-penyusun')?.value || '').trim();
  const tujuan = (document.getElementById('rencana-tujuan')?.value || '').trim();
  const deskripsi = (document.getElementById('rencana-deskripsi')?.value || '').trim();

  if (!judul || !tglMulai || !targetPeserta || !pic) {
    showToast('Harap lengkapi judul rencana, target sasaran, PIC, dan tanggal pelaksanaan!', 'error');
    return;
  }

  const editId = document.getElementById('rencana-edit-id')?.value;
  let list = getRencanaKegiatanList();

  if (editId) {
    const numId = parseInt(editId, 10);
    const idx = list.findIndex(x => x.id === numId);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        judul,
        kategori,
        prioritas,
        targetPeserta,
        penanggungJawab: pic,
        tglMulai,
        tglSelesai: tglSelesai || tglMulai,
        status,
        lokasi,
        estimasiBiaya,
        sumberDana,
        penyusun,
        tujuan,
        deskripsi,
        updatedAt: new Date().toISOString()
      };
      DB.set('lhg_rencana_kegiatan', list);
      showToast('Rencana kegiatan berhasil diperbarui!', 'success');
    }
  } else {
    const newRecord = {
      id: Date.now(),
      judul,
      kategori,
      prioritas,
      targetPeserta,
      penanggungJawab: pic,
      tglMulai,
      tglSelesai: tglSelesai || tglMulai,
      status,
      lokasi,
      estimasiBiaya,
      sumberDana,
      penyusun,
      tujuan,
      deskripsi,
      createdAt: new Date().toISOString()
    };
    list.unshift(newRecord);
    DB.set('lhg_rencana_kegiatan', list);
    showToast('Rencana kegiatan baru berhasil disusun!', 'success');
  }

  closeModal('modal-rencana-kegiatan');
  renderRencanaKegiatanPage();
}

async function deleteRencanaKegiatan(id) {
  const confirmed = await showModernConfirm({
    title: 'Hapus Rencana Kegiatan',
    message: 'Apakah Anda yakin ingin menghapus rencana kegiatan ini?',
    subtext: 'Rencana program kerja yayasan akan dihapus dari agenda.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    icon: 'delete'
  });
  if (!confirmed) return;
  let list = getRencanaKegiatanList().filter(x => x.id !== id);
  localStorage.setItem('lhg_rencana_kegiatan', JSON.stringify(list));
  try {
    await SupabaseAPI.delete('lhg_rencana_kegiatan', 'id', id);
  } catch (e) {
    console.warn('Gagal menghapus rencana kegiatan dari cloud:', e);
  }
  renderRencanaKegiatanPage();
  showToast('Rencana kegiatan telah dihapus.', 'warning');
}

function viewRencanaKegiatan(id) {
  const item = getRencanaKegiatanList().find(x => x.id === id);
  if (!item) {
    showToast('Data rencana tidak ditemukan!', 'error');
    return;
  }

  setText('view-rencana-judul', item.judul || 'Rencana Kegiatan');
  setText('view-rencana-meta', `Kategori: ${item.kategori} | PIC: ${item.penanggungJawab || '-'}`);

  let tglStr = formatDate(item.tglMulai);
  if (item.tglSelesai && item.tglSelesai !== item.tglMulai) {
    tglStr += ` s/d ${formatDate(item.tglSelesai)}`;
  }

  const bodyEl = document.getElementById('view-rencana-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 18px; flex-wrap: wrap;">
        ${getRencanaStatusBadge(item.status || 'Draf / Pengajuan')}
        ${getRencanaPrioritasBadge(item.prioritas || 'Sedang')}
        <span style="font-size: 11px; color: #64748B; font-weight: 600;">🏷️ Kategori: ${item.kategori}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Target Sasaran & Peserta</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 4px;">🎯 ${item.targetPeserta || '-'}</div>
        </div>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Jadwal Pelaksanaan</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 4px;">📅 ${tglStr}</div>
        </div>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Lokasi / Tempat</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 4px;">📍 ${item.lokasi || 'Sekretariat Yayasan'}</div>
        </div>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Estimasi Anggaran & Sumber Dana</div>
          <div style="font-size: 13px; font-weight: 800; color: #2563EB; margin-top: 4px;">💰 ${item.estimasiBiaya || 'Swadaya'}</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Sumber: ${item.sumberDana || 'Kas Yayasan'}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Penanggung Jawab (PIC)</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 4px;">👤 ${item.penanggungJawab || '-'}</div>
        </div>
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Petugas Penyusun Dokumen</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 4px;">✍️ ${item.penyusun || '-'}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">🎯 Tujuan & Target Capaian (Indikator Keberhasilan):</div>
        <div style="background: #F1F5F9; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; line-height: 1.6; color: #1E293B; white-space: pre-wrap;">${item.tujuan || 'Belum diisi.'}</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">📝 Rincian Langkah Kerja & Tahapan Pelaksanaan:</div>
        <div style="background: #F1F5F9; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; line-height: 1.6; color: #1E293B; white-space: pre-wrap;">${item.deskripsi || 'Belum diisi.'}</div>
      </div>
    `;
  }

  const leftActionsEl = document.getElementById('view-rencana-left-actions');
  if (leftActionsEl) {
    leftActionsEl.innerHTML = `
      <button type="button" class="btn-top-add" style="background: #2563EB;" onclick="printRencanaKegiatanDoc(${item.id})">
        <span>🖨️</span> Cetak Lembar Rencana Kerja (Format Resmi A4)
      </button>
    `;
  }

  const modal = document.getElementById('modal-view-rencana');
  if (modal) modal.classList.add('open');
}

function printRencanaKegiatanDoc(id) {
  const item = getRencanaKegiatanList().find(x => x.id === id);
  if (!item) {
    showToast('Data rencana tidak ditemukan!', 'error');
    return;
  }

  let tglStr = formatDate(item.tglMulai);
  if (item.tglSelesai && item.tglSelesai !== item.tglMulai) {
    tglStr += ` s/d ${formatDate(item.tglSelesai)}`;
  }

  const todayStr = formatDate(new Date().toISOString().split('T')[0]);
  const docNo = `RK-LHG/${new Date().getFullYear()}/${String(item.id).slice(-4)}`;

  const win = window.open('', '_blank');
  if (!win) {
    showToast('Izinkan jendela pop-up untuk mencetak dokumen!', 'warning');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Rencana Kerja Yayasan - ${item.judul}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 18mm 14mm 18mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
          background: #fff;
          font-size: 12px;
          line-height: 1.55;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .kop-surat { text-align: center; margin-bottom: 18px; }
        .kop-logo-img { width: 68px; height: 68px; object-fit: contain; margin-bottom: 4px; }
        .kop-sublogo { font-size: 9px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #000; }
        .kop-org-name { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; margin: 6px 0 2px 0; text-transform: uppercase; }
        .kop-org-prov { font-size: 12.5px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
        .kop-divider-double { border-top: 3px solid #000; border-bottom: 1px solid #000; height: 4px; width: 100%; margin: 0 auto 18px auto; }
        
        .doc-header { text-align: center; margin-bottom: 20px; }
        .doc-title { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; text-decoration: underline; }
        .doc-number { font-size: 11px; font-weight: 700; color: #333; margin-top: 4px; }
        
        .section-label { font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 16px 0 6px 0; border-bottom: 1.5px solid #CBD5E1; padding-bottom: 3px; }
        
        .table-data { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
        .table-data tr td { padding: 5px 4px; vertical-align: top; }
        .col-lbl { width: 200px; font-weight: 700; }
        .col-colon { width: 15px; text-align: center; font-weight: 700; }
        .col-val { }

        .box-text { border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; margin-bottom: 14px; background: #FAFBFD; white-space: pre-wrap; text-align: justify; }

        .ttd-row { display: flex; justify-content: space-between; margin-top: 36px; break-inside: avoid; }
        .ttd-box { width: 230px; text-align: center; font-size: 11.5px; }
        .ttd-space { height: 75px; }
        .ttd-name { font-weight: 800; text-decoration: underline; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="kop-surat">
        <img src="img/logo-circle.png" alt="Logo LHG" class="kop-logo-img">
        <div class="kop-sublogo">Sistem Informasi & Pelayanan Anak Disabilitas</div>
        <div class="kop-org-name">YAYASAN LENTERA HATI GURINDAM</div>
        <div class="kop-org-prov">KOTA TANJUNGPINANG - KEPULAUAN RIAU</div>
      </div>
      <div class="kop-divider-double"></div>

      <div class="doc-header">
        <div class="doc-title">LEMBAR RENCANA KERJA & PROGRAM KEGIATAN YAYASAN</div>
        <div class="doc-number">Nomor Dokumen: ${docNo}</div>
      </div>

      <div class="section-label">I. IDENTITAS & RENCANA PROGRAM</div>
      <table class="table-data">
        <tr>
          <td class="col-lbl">Nama Program / Kegiatan</td>
          <td class="col-colon">:</td>
          <td class="col-val" style="font-weight: 800;">${item.judul}</td>
        </tr>
        <tr>
          <td class="col-lbl">Kategori Bidang</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.kategori}</td>
        </tr>
        <tr>
          <td class="col-lbl">Target Sasaran Peserta</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.targetPeserta || '-'}</td>
        </tr>
        <tr>
          <td class="col-lbl">Rencana Waktu Pelaksanaan</td>
          <td class="col-colon">:</td>
          <td class="col-val">${tglStr}</td>
        </tr>
        <tr>
          <td class="col-lbl">Lokasi / Tempat Pelaksanaan</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.lokasi || 'Sekretariat Yayasan Lentera Hati Gurindam'}</td>
        </tr>
        <tr>
          <td class="col-lbl">Tingkat Prioritas & Status</td>
          <td class="col-colon">:</td>
          <td class="col-val">Prioritas ${item.prioritas || 'Sedang'} / Status: <strong>${item.status || 'Draf / Pengajuan'}</strong></td>
        </tr>
      </table>

      <div class="section-label">II. ANGGARAN BIAYA & PENANGGUNG JAWAB</div>
      <table class="table-data">
        <tr>
          <td class="col-lbl">Estimasi Kebutuhan Biaya</td>
          <td class="col-colon">:</td>
          <td class="col-val" style="font-weight: 800;">${item.estimasiBiaya || 'Swadaya / Nihil'}</td>
        </tr>
        <tr>
          <td class="col-lbl">Rencana Sumber Dana</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.sumberDana || 'Kas Operasional Yayasan'}</td>
        </tr>
        <tr>
          <td class="col-lbl">Penanggung Jawab (PIC)</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.penanggungJawab || '-'}</td>
        </tr>
        <tr>
          <td class="col-lbl">Petugas Penyusun Dokumen</td>
          <td class="col-colon">:</td>
          <td class="col-val">${item.penyusun || '-'}</td>
        </tr>
      </table>

      <div class="section-label">III. TUJUAN & INDIKATOR KEBERHASILAN</div>
      <div class="box-text">${item.tujuan || 'Tujuan pelaksanaan kegiatan ini dirancang untuk mendukung kemandirian, sosialisasi, dan kesejahteraan anak penyandang disabilitas binaan Yayasan Lentera Hati Gurindam.'}</div>

      <div class="section-label">IV. TAHAPAN LANGKAH KERJA & TEKNIS PELAKSANAAN</div>
      <div class="box-text">${item.deskripsi || 'Rincian langkah persiapan teknis disesuaikan dengan SOP Yayasan Lentera Hati Gurindam bersama para panitia/petugas terkait.'}</div>

      <div class="ttd-row">
        <div class="ttd-box">
          <div>Disusun Oleh,</div>
          <div style="font-weight: 700; margin-top: 2px;">Petugas Pelaksana / PIC</div>
          <div class="ttd-space"></div>
          <div class="ttd-name">${item.penyusun || item.penanggungJawab || 'Petugas Yayasan'}</div>
          <div>Lentera Hati Gurindam</div>
        </div>

        <div class="ttd-box">
          <div>Tanjungpinang, ${todayStr}</div>
          <div style="font-weight: 700; margin-top: 2px;">Menyetujui, Ketua Yayasan</div>
          <div class="ttd-space"></div>
          <div class="ttd-name">KAMARIDA</div>
          <div>Ketua Yayasan LHG</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

function printRekapRencanaKegiatan() {
  const list = getRencanaKegiatanList();
  if (!list.length) {
    showToast('Belum ada data rencana kegiatan untuk dicetak!', 'warning');
    return;
  }

  const todayStr = formatDate(new Date().toISOString().split('T')[0]);
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Izinkan jendela pop-up untuk mencetak!', 'warning');
    return;
  }

  const rowsHtml = list.map((item, i) => `
    <tr>
      <td style="text-align: center;">${i + 1}</td>
      <td style="font-weight: 700;">${item.judul}</td>
      <td>${item.kategori}</td>
      <td>${item.targetPeserta || '-'}</td>
      <td>${formatDate(item.tglMulai)}</td>
      <td>${item.lokasi || '-'}</td>
      <td style="font-weight: 700;">${item.estimasiBiaya || '-'}</td>
      <td>${item.penanggungJawab || '-'}</td>
      <td style="text-align: center;">${item.prioritas || 'Sedang'}</td>
      <td style="text-align: center;">${item.status || 'Draf'}</td>
    </tr>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Rekapitulasi Rencana Kerja Yayasan</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 6px; }
        .kop { text-align: center; border-bottom: 2.5px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
        .kop h2 { font-size: 15px; text-transform: uppercase; margin-bottom: 3px; font-weight: 900; }
        .kop p { font-size: 11px; font-weight: 700; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
        th, td { border: 1px solid #333; padding: 6px 5px; }
        th { background: #E2E8F0; font-weight: 800; text-align: center; }
        .ttd { display: flex; justify-content: flex-end; margin-top: 24px; break-inside: avoid; }
        .ttd-box { width: 220px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="kop">
        <h2>YAYASAN LENTERA HATI GURINDAM TANJUNGPINANG</h2>
        <p>REKAPITULASI RENCANA KEGIATAN & PROGRAM KERJA YAYASAN</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">NO</th>
            <th>PROGRAM / RENCANA KEGIATAN</th>
            <th>KATEGORI</th>
            <th>TARGET SASARAN</th>
            <th>JADWAL</th>
            <th>LOKASI</th>
            <th>ANGGARAN</th>
            <th>PIC</th>
            <th>PRIORITAS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="ttd">
        <div class="ttd-box">
          <div>Tanjungpinang, ${todayStr}</div>
          <div style="font-weight: 700; margin-top: 3px;">Ketua Yayasan LHG</div>
          <div style="height: 60px;"></div>
          <div style="font-weight: 800; text-decoration: underline;">KAMARIDA</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// ==============================================================================
// SUPABASE SYNC LOGIC (CLOUD DATA SYNCHRONIZATION)
// ==============================================================================

// Mapping local camelCase objects to database snake_case columns
function toSupabaseRow(table, item) {
  if (table === 'lhg_users') {
    return {
      username: item.username,
      password: item.password,
      nama: item.nama,
      role: item.role,
      status: item.status
    };
  }
  if (table === 'lhg_anggota') {
    return {
      id: item.id,
      nama: item.nama,
      nik: item.nik,
      no_kk: item.noKk || item.no_kk || null,
      umur: item.umur || null,
      ttl: item.ttl || null,
      jk: item.jk || null,
      alamat: item.alamat || null,
      kelurahan: item.kelurahan || null,
      disabilitas: item.disabilitas,
      sub_disabilitas: item.subDisabilitas || item.sub_disabilitas || null,
      wali: item.wali || null,
      ibu: item.ibu || null,
      hub_wali: item.hubWali || item.hub_wali || null,
      tel_wali: item.telWali || item.tel_wali || null,
      kontak_wa: item.kontakWA || item.kontak_wa || null,
      status: item.status || 'Aktif',
      no_anggota: item.noAnggota || item.no_anggota || item.id,
      tgl_daftar: item.tglDaftar || item.tgl_daftar || null,
      kelas: item.kelas || null,
      sekolah: item.sekolah || null,
      foto: item.foto || null
    };
  }
  if (table === 'lhg_bantuan') {
    return {
      id: item.id,
      anak_id: item.anakId || item.anak_id || null,
      anak_nama: item.anakNama || item.anak_nama || null,
      anak_nik: item.anakNik || item.anak_nik || null,
      anak_disabilitas: item.anakDisabilitas || item.anak_disabilitas || null,
      nama_bantuan: item.namaBantuan || item.nama_bantuan,
      kategori: item.kategori,
      tanggal: item.tanggal,
      jumlah: item.jumlah || null,
      petugas: item.petugas || null,
      sumber: item.sumber || null,
      keterangan: item.keterangan || null
    };
  }
  if (table === 'lhg_kegiatan') {
    return {
      id: item.id,
      judul: item.judul,
      tanggal: item.tanggal,
      lokasi: item.lokasi || null,
      peserta: item.peserta || 0,
      deskripsi: item.deskripsi || null,
      status: item.status || 'Selesai'
    };
  }
  if (table === 'lhg_surat_masuk') {
    return {
      id: item.id,
      nomor: item.nomor,
      tanggal: item.tanggal,
      pengirim: item.pengirim,
      perihal: item.perihal,
      keterangan: item.keterangan || null,
      status: item.status || 'Diproses'
    };
  }
  if (table === 'lhg_surat_keluar') {
    return {
      id: item.id,
      nomor: item.nomor,
      tanggal: item.tanggal,
      tujuan: item.tujuan,
      perihal: item.perihal,
      keterangan: item.keterangan || null,
      status: item.status || 'Terkirim'
    };
  }
  if (table === 'lhg_foto') {
    return {
      id: item.id,
      judul: item.judul,
      tanggal: item.tanggal || null,
      kategori: item.kategori || null,
      deskripsi: item.deskripsi || null,
      url: item.url
    };
  }
  if (table === 'lhg_arsip') {
    return {
      id: item.id,
      nomor: item.nomor || null,
      nama: item.nama,
      kategori: item.kategori,
      tanggal: item.tanggal || null,
      lokasi_fisik: item.lokasiFisik || item.lokasi_fisik || null,
      penerbit: item.penerbit || null,
      keterangan: item.keterangan || null,
      file_url: item.fileUrl || item.file_url || null,
      file_name: item.fileName || item.file_name || null,
      uploaded_by: item.uploadedBy || item.uploaded_by || null
    };
  }
  if (table === 'lhg_rencana_kegiatan') {
    return {
      id: item.id,
      judul: item.judul,
      kategori: item.kategori,
      penanggung_jawab: item.penanggungJawab || item.penanggung_jawab || null,
      target_peserta: item.targetPeserta || item.target_peserta || null,
      lokasi: item.lokasi || null,
      tgl_mulai: item.tglMulai || item.tgl_mulai || null,
      tgl_selesai: item.tglSelesai || item.tgl_selesai || null,
      estimasi_biaya: item.estimasiBiaya || item.estimasi_biaya || null,
      sumber_dana: item.sumberDana || item.sumber_dana || null,
      prioritas: item.prioritas || 'Sedang',
      status: item.status || 'Draf / Pengajuan',
      tujuan: item.tujuan || null,
      deskripsi: item.deskripsi || null,
      penyusun: item.penyusun || null
    };
  }
  return item;
}

// Convert database snake_case row to frontend camelCase
function fromSupabaseRow(table, row) {
  if (table === 'lhg_users') {
    return {
      username: row.username,
      password: row.password,
      nama: row.nama,
      role: row.role,
      status: row.status,
      createdAt: row.created_at ? row.created_at.split('T')[0] : (row.createdAt || '-')
    };
  }
  if (table === 'lhg_anggota') {
    return {
      id: row.id,
      nama: row.nama,
      nik: row.nik,
      noKk: row.no_kk,
      umur: row.umur,
      ttl: row.ttl,
      jk: row.jk,
      alamat: row.alamat,
      kelurahan: row.kelurahan,
      disabilitas: row.disabilitas,
      subDisabilitas: row.sub_disabilitas,
      wali: row.wali,
      ibu: row.ibu,
      hubWali: row.hub_wali,
      telWali: row.tel_wali,
      kontakWA: row.kontak_wa,
      status: row.status,
      noAnggota: row.no_anggota || row.id,
      tglDaftar: row.tgl_daftar,
      kelas: row.kelas,
      sekolah: row.sekolah,
      foto: row.foto
    };
  }
  if (table === 'lhg_bantuan') {
    return {
      id: row.id,
      anakId: row.anak_id,
      anakNama: row.anak_nama,
      anakNik: row.anak_nik,
      anakDisabilitas: row.anak_disabilitas,
      namaBantuan: row.nama_bantuan,
      kategori: row.kategori,
      tanggal: row.tanggal,
      jumlah: row.jumlah,
      petugas: row.petugas,
      sumber: row.sumber,
      keterangan: row.keterangan
    };
  }
  if (table === 'lhg_arsip') {
    return {
      id: row.id,
      nomor: row.nomor,
      nama: row.nama,
      kategori: row.kategori,
      tanggal: row.tanggal,
      lokasiFisik: row.lokasi_fisik,
      penerbit: row.penerbit,
      keterangan: row.keterangan,
      fileUrl: row.file_url,
      fileName: row.file_name,
      uploadedBy: row.uploaded_by
    };
  }
  if (table === 'lhg_rencana_kegiatan') {
    return {
      id: row.id,
      judul: row.judul,
      kategori: row.kategori,
      penanggungJawab: row.penanggung_jawab,
      targetPeserta: row.target_peserta,
      lokasi: row.lokasi,
      tglMulai: row.tgl_mulai,
      tglSelesai: row.tgl_selesai,
      estimasiBiaya: row.estimasi_biaya,
      sumberDana: row.sumber_dana,
      prioritas: row.prioritas,
      status: row.status,
      tujuan: row.tujuan,
      deskripsi: row.deskripsi,
      penyusun: row.penyusun,
      createdAt: row.created_at
    };
  }
  return row;
}

// Sync one key changes to Supabase Cloud
async function syncKeyToSupabase(key, val) {
  if (!Array.isArray(val)) return;
  const table = key; // matching table name
  const validTables = ['lhg_users', 'lhg_anggota', 'lhg_bantuan', 'lhg_kegiatan', 'lhg_surat_masuk', 'lhg_surat_keluar', 'lhg_foto', 'lhg_arsip', 'lhg_rencana_kegiatan'];
  if (!validTables.includes(table)) return;

  try {
    const rows = val.map(item => toSupabaseRow(table, item));
    if (rows.length > 0) {
      await SupabaseAPI.upsert(table, rows);
    }
  } catch(e) {
    // Fail silently to preserve offline capability
  }
}

// Master bidirectional synchronization with Supabase
async function syncWithSupabase(isManual) {
  if (isManual) {
    showToast('Memeriksa koneksi database online Supabase...', 'info');
  }

  const isOnline = await SupabaseAPI.checkConnection();
  if (!isOnline) {
    if (isManual) {
      showToast('Koneksi Supabase belum aktif atau tabel belum dibuat. Menjalankan mode database lokal.', 'warning');
    }
    return;
  }

  const tables = ['lhg_users', 'lhg_anggota', 'lhg_bantuan', 'lhg_kegiatan', 'lhg_surat_masuk', 'lhg_surat_keluar', 'lhg_foto', 'lhg_arsip', 'lhg_rencana_kegiatan'];
  let syncedCount = 0;

  for (const t of tables) {
    try {
      const cloudData = await SupabaseAPI.select(t);
      if (cloudData !== null) {
        if (cloudData.length > 0) {
          if (t === 'lhg_users') {
            const deleted = getDeletedUsers();

            // 1. Hapus akun di Supabase yang sudah pernah dihapus oleh user
            for (const r of cloudData) {
              if (deleted.includes(r.username)) {
                await SupabaseAPI.delete('lhg_users', 'username', r.username);
              }
            }

            // 2. Ambil hanya akun yang aktif / tidak terhapus
            const activeCloud = cloudData.filter(r => !deleted.includes(r.username));
            const localUsers = JSON.parse(localStorage.getItem('lhg_users') || '[]')
              .filter(u => !deleted.includes(u.username));

            // 3. Gabungkan cloud dan local (data local & perubahan tidak akan tertimpa ke default)
            const userMap = new Map();
            activeCloud.forEach(r => {
              userMap.set(r.username, fromSupabaseRow('lhg_users', r));
            });
            localUsers.forEach(u => {
              userMap.set(u.username, u);
            });

            // 4. Pastikan Superadmin utama selalu ada
            if (!userMap.has('2172041908850002')) {
              userMap.set('2172041908850002', {
                username: '2172041908850002',
                password: '19081985',
                nama: 'KAMARIDA',
                role: 'Superadmin',
                status: 'Aktif',
                createdAt: '2024-01-01'
              });
            }

            const finalUsers = Array.from(userMap.values());
            localStorage.setItem('lhg_users', JSON.stringify(finalUsers));

            // Sync semua akun aktif ke cloud
            const rowsToUpsert = finalUsers.map(item => toSupabaseRow('lhg_users', item));
            if (rowsToUpsert.length > 0) {
              await SupabaseAPI.upsert('lhg_users', rowsToUpsert);
            }
          } else {
            // Download latest from cloud and cache in localStorage
            const mapped = cloudData.map(r => fromSupabaseRow(t, r));
            localStorage.setItem(t, JSON.stringify(mapped));
          }
          syncedCount++;
        } else {
          // Cloud table is empty: If it's operational data, ensure local cache is also empty (clean slate)
          if (t !== 'lhg_users') {
            localStorage.setItem(t, JSON.stringify([]));
          } else {
            // If users table in cloud is empty, seed active local users
            const localUsers = JSON.parse(localStorage.getItem(t) || '[]');
            const deleted = getDeletedUsers();
            const activeUsers = localUsers.filter(u => !deleted.includes(u.username));
            if (activeUsers.length > 0) {
              const rows = activeUsers.map(item => toSupabaseRow(t, item));
              await SupabaseAPI.upsert(t, rows);
            }
          }
          syncedCount++;
        }
      }
    } catch(e) {
      // Continue to next table
    }
  }

  // Refresh current view if logged in
  const curUser = getAuthUser();
  if (curUser) {
    applyRoleUI(curUser);
    const activePageBtn = document.querySelector('.sidebar-nav .nav-item.active');
    const activePage = activePageBtn ? activePageBtn.getAttribute('data-page') : 'dashboard';
    if (activePage === 'dashboard') renderDashboard();
    if (activePage === 'input-data') renderAnggotaTable();
    if (activePage === 'bantuan') renderBantuanPage();
    if (activePage === 'rencana-kegiatan') renderRencanaKegiatanPage();
    if (activePage === 'arsip-berkas') renderArsip();
    if (activePage === 'foto-kegiatan') renderFoto();
    if (activePage === 'manajemen-user') renderManajemenUserTable();
  }

  if (isManual) {
    showToast(`Sinkronisasi Supabase Online selesai! (${syncedCount} tabel)`, 'success');
  }
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initData();
  updateClock();
  setInterval(updateClock, 1000);
  initAuth();
  // Check and sync with Supabase Online in background
  syncWithSupabase(false);
  // Register PWA Service Worker
  registerPWA();
  // Initialize touch-friendly modal backdrop tap listeners
  initModalListeners();
});

function initModalListeners() {
  // Tap outside modal content (on overlay backdrop) to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Keep body class modal-open in sync with any modal open state to prevent background scroll
  const modalObserver = new MutationObserver(() => {
    const hasOpenModal = !!document.querySelector('.modal-overlay.open');
    document.body.classList.toggle('modal-open', hasOpenModal);
  });

  document.querySelectorAll('.modal-overlay').forEach(m => {
    modalObserver.observe(m, { attributes: true, attributeFilter: ['class'] });
  });
}

// ==============================================================================
// PWA INSTALLATION & SERVICE WORKER LOGIC
// ==============================================================================
let deferredInstallPrompt = null;

function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker Registered successfully:', reg.scope);
      })
      .catch(err => {
        console.warn('Service Worker Registration failed:', err);
      });
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent browser default mini-infobar
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('App is installable as PWA');

  // Highlight install buttons
  const btnLogin = document.getElementById('btn-install-app-login');
  const btnTop = document.getElementById('btn-install-app-topbar');
  if (btnLogin) btnLogin.style.display = 'flex';
  if (btnTop) btnTop.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('Aplikasi Lentera Hati Gurindam berhasil diinstall!', 'success');
  const btnLogin = document.getElementById('btn-install-app-login');
  const btnTop = document.getElementById('btn-install-app-topbar');
  if (btnLogin) btnLogin.style.display = 'none';
  if (btnTop) btnTop.style.display = 'none';
});

function triggerInstallApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Memulai instalasi aplikasi...', 'success');
      } else {
        showToast('Instalasi dibatalkan oleh pengguna.', 'info');
      }
      deferredInstallPrompt = null;
    });
  } else {
    // If browser doesn't support beforeinstallprompt or already installed
    showToast('Untuk menginstall: Buka menu titik tiga browser (⋮) lalu pilih "Install Aplikasi" atau "Tambahkan ke Layar Utama".', 'info');
  }
}
