-- ==============================================================
-- SIPERSEDIA BPS - SQL SCHEMA FOR SUPABASE
-- Run this in Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- Project: praqeqppsxdntoyaukio
-- ==============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== PROFILES ==========
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  bidang VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== KATEGORI ==========
CREATE TABLE IF NOT EXISTS kategori (
  id SERIAL PRIMARY KEY,
  nama_kategori VARCHAR(255) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== SATUAN ==========
CREATE TABLE IF NOT EXISTS satuan (
  id SERIAL PRIMARY KEY,
  nama_satuan VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== LOKASI ==========
CREATE TABLE IF NOT EXISTS lokasi (
  id SERIAL PRIMARY KEY,
  nama_lokasi VARCHAR(255) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== BARANG ==========
CREATE TABLE IF NOT EXISTS barang (
  id SERIAL PRIMARY KEY,
  kode_barang VARCHAR(50) NOT NULL UNIQUE,
  nama_barang VARCHAR(255) NOT NULL,
  id_kategori INT REFERENCES kategori(id) ON DELETE SET NULL,
  id_satuan INT REFERENCES satuan(id) ON DELETE SET NULL,
  id_lokasi INT REFERENCES lokasi(id) ON DELETE SET NULL,
  stok INT NOT NULL DEFAULT 0,
  stok_minimum INT NOT NULL DEFAULT 0,
  foto_url TEXT,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== TRANSAKSI MASUK ==========
CREATE TABLE IF NOT EXISTS transaksi_masuk (
  id SERIAL PRIMARY KEY,
  no_dokumen VARCHAR(50) NOT NULL UNIQUE,
  id_barang INT REFERENCES barang(id) ON DELETE CASCADE,
  jumlah INT NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  sumber VARCHAR(50) NOT NULL DEFAULT 'Pembelian',
  no_surat_jalan VARCHAR(100),
  harga_satuan DECIMAL(15,2),
  keterangan TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== TRANSAKSI KELUAR ==========
CREATE TABLE IF NOT EXISTS transaksi_keluar (
  id SERIAL PRIMARY KEY,
  no_dokumen VARCHAR(50) NOT NULL UNIQUE,
  id_barang INT REFERENCES barang(id) ON DELETE CASCADE,
  jumlah INT NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tujuan VARCHAR(255),
  pemohon VARCHAR(255),
  keterangan TEXT,
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== LAPORAN BULANAN ==========
CREATE TABLE IF NOT EXISTS laporan_bulanan (
  id SERIAL PRIMARY KEY,
  bulan INT NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun INT NOT NULL,
  data_rekapitulasi JSONB NOT NULL DEFAULT '[]',
  generated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bulan, tahun)
);

-- ========== SEED DATA ==========
INSERT INTO kategori (nama_kategori, deskripsi) VALUES
  ('Alat Tulis Kantor', 'Perlengkapan tulis perkantoran'),
  ('Peralatan Komputer', 'Perangkat keras dan aksesoris komputer'),
  ('Perlengkapan Rumah Tangga', 'Kebutuhan rumah tangga kantor'),
  ('Alat Kebersihan', 'Peralatan untuk kebersihan kantor'),
  ('Perlengkapan Cetakan', 'Formulir, buku, dan cetakan'),
  ('Peralatan Elektronik', 'Perangkat elektronik kantor')
ON CONFLICT (nama_kategori) DO NOTHING;

INSERT INTO satuan (nama_satuan) VALUES
  ('Buah'), ('Rim'), ('Lusin'), ('Pak'), ('Dus'), ('Set'),
  ('Unit'), ('Lembar'), ('Roll'), ('Botol'), ('Kotak'), ('Batang')
ON CONFLICT (nama_satuan) DO NOTHING;

INSERT INTO lokasi (nama_lokasi, deskripsi) VALUES
  ('Gudang Utama', 'Ruang penyimpanan utama lantai 1'),
  ('Gudang ATK', 'Ruang penyimpanan khusus alat tulis kantor'),
  ('Rak Server', 'Tempat penyimpanan peralatan IT'),
  ('Ruang Arsip', 'Ruang penyimpanan dokumen dan cetakan')
ON CONFLICT (nama_lokasi) DO NOTHING;

-- Enable RLS and public policies for Anon client
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE satuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE lokasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_keluar ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_bulanan ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'barang' AND policyname = 'Public access to barang') THEN
    CREATE POLICY "Public access to barang" ON barang FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kategori' AND policyname = 'Public access to kategori') THEN
    CREATE POLICY "Public access to kategori" ON kategori FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'satuan' AND policyname = 'Public access to satuan') THEN
    CREATE POLICY "Public access to satuan" ON satuan FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lokasi' AND policyname = 'Public access to lokasi') THEN
    CREATE POLICY "Public access to lokasi" ON lokasi FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaksi_masuk' AND policyname = 'Public access to transaksi_masuk') THEN
    CREATE POLICY "Public access to transaksi_masuk" ON transaksi_masuk FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaksi_keluar' AND policyname = 'Public access to transaksi_keluar') THEN
    CREATE POLICY "Public access to transaksi_keluar" ON transaksi_keluar FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'laporan_bulanan' AND policyname = 'Public access to laporan_bulanan') THEN
    CREATE POLICY "Public access to laporan_bulanan" ON laporan_bulanan FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public access to profiles') THEN
    CREATE POLICY "Public access to profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
