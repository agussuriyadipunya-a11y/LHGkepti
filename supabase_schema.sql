-- ==============================================================================
-- LENTERA HATI GURINDAM - SUPABASE DATABASE INITIALIZATION SCHEMA
-- ==============================================================================
-- Jalankan query SQL ini pada SQL Editor di Dashboard Supabase:
-- Project: https://supabase.com/dashboard/project/eimjtamfuyeyhqhfumur/sql

-- 1. TABEL PENGGUNA SISTEM (USERS & MULTI-ROLE)
CREATE TABLE IF NOT EXISTS lhg_users (
    username VARCHAR(100) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    nama VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Petugas',
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL DATA ANAK DISABILITAS (ANGGOTA BINAAN - SIAP DATA KOSONG)
CREATE TABLE IF NOT EXISTS lhg_anggota (
    id VARCHAR(50) PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    nik VARCHAR(50) NOT NULL,
    no_kk VARCHAR(50),
    umur VARCHAR(50),
    ttl VARCHAR(255),
    jk VARCHAR(10),
    alamat TEXT,
    kelurahan VARCHAR(100),
    disabilitas VARCHAR(100) NOT NULL,
    sub_disabilitas VARCHAR(255),
    wali VARCHAR(255),
    ibu VARCHAR(255),
    hub_wali VARCHAR(50),
    tel_wali VARCHAR(50),
    kontak_wa VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Aktif',
    no_anggota VARCHAR(50),
    tgl_daftar DATE,
    kelas VARCHAR(50),
    sekolah VARCHAR(255),
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL CATATAN PENYERAHAN BANTUAN
CREATE TABLE IF NOT EXISTS lhg_bantuan (
    id BIGINT PRIMARY KEY,
    anak_id VARCHAR(50),
    anak_nama VARCHAR(255),
    anak_nik VARCHAR(50),
    anak_disabilitas VARCHAR(100),
    nama_bantuan VARCHAR(255) NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL,
    jumlah VARCHAR(100),
    petugas VARCHAR(255),
    sumber VARCHAR(255),
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL AGENDA KEGIATAN & TERAPI
CREATE TABLE IF NOT EXISTS lhg_kegiatan (
    id BIGINT PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL,
    lokasi VARCHAR(255),
    peserta INT DEFAULT 0,
    deskripsi TEXT,
    status VARCHAR(50) DEFAULT 'Selesai',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL SURAT MASUK
CREATE TABLE IF NOT EXISTS lhg_surat_masuk (
    id BIGINT PRIMARY KEY,
    nomor VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL,
    pengirim VARCHAR(255) NOT NULL,
    perihal TEXT NOT NULL,
    keterangan TEXT,
    status VARCHAR(50) DEFAULT 'Diproses',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL SURAT KELUAR
CREATE TABLE IF NOT EXISTS lhg_surat_keluar (
    id BIGINT PRIMARY KEY,
    nomor VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL,
    tujuan VARCHAR(255) NOT NULL,
    perihal TEXT NOT NULL,
    keterangan TEXT,
    status VARCHAR(50) DEFAULT 'Terkirim',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL GALERI FOTO KEGIATAN
CREATE TABLE IF NOT EXISTS lhg_foto (
    id BIGINT PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    tanggal DATE,
    kategori VARCHAR(100),
    deskripsi TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- AKTIFKAN ROW LEVEL SECURITY (RLS) DENGAN KEBIJAKAN AKSES LENGKAP
-- ==============================================================================
ALTER TABLE lhg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_bantuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_surat_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_surat_keluar ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhg_foto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses_Publik_lhg_users" ON lhg_users;
DROP POLICY IF EXISTS "Akses_Publik_lhg_anggota" ON lhg_anggota;
DROP POLICY IF EXISTS "Akses_Publik_lhg_bantuan" ON lhg_bantuan;
DROP POLICY IF EXISTS "Akses_Publik_lhg_kegiatan" ON lhg_kegiatan;
DROP POLICY IF EXISTS "Akses_Publik_lhg_surat_masuk" ON lhg_surat_masuk;
DROP POLICY IF EXISTS "Akses_Publik_lhg_surat_keluar" ON lhg_surat_keluar;
DROP POLICY IF EXISTS "Akses_Publik_lhg_foto" ON lhg_foto;

CREATE POLICY "Akses_Publik_lhg_users" ON lhg_users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_anggota" ON lhg_anggota FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_bantuan" ON lhg_bantuan FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_kegiatan" ON lhg_kegiatan FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_surat_masuk" ON lhg_surat_masuk FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_surat_keluar" ON lhg_surat_keluar FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses_Publik_lhg_foto" ON lhg_foto FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- KOSONGKAN DATA TABEL OPERASIONAL (SIAP PAKAI DENGAN DATABASE BERSIH)
-- ==============================================================================
TRUNCATE TABLE lhg_anggota, lhg_bantuan, lhg_kegiatan, lhg_surat_masuk, lhg_surat_keluar, lhg_foto;

-- HANYA SIAPKAN AKUN PENGGUNA RESMI (SUPERADMIN, ADMIN, PETUGAS)
INSERT INTO lhg_users (username, password, nama, role, status)
VALUES 
('2172041908850002', '19081985', 'KAMARIDA', 'Superadmin', 'Aktif'),
('admin', 'admin123', 'Admin Pelayanan LHG', 'Admin', 'Aktif'),
('petugas', 'petugas123', 'Petugas Lapangan', 'Petugas', 'Aktif')
ON CONFLICT (username) DO NOTHING;
