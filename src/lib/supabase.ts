import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://praqeqppsxdntoyaukio.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYXFlcXBwc3hkbnRveWF1a2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDA0NDksImV4cCI6MjEwNzc3NjQ0OX0.L-fBjEvbkTlg7vXPxmIE5bbltad7vZnmZ15YAa1k9t8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey);
  }
  return supabase;
}

// ==========================================
// Supabase Database Schema (SQL)
// Jalankan query ini di Supabase SQL Editor
// ==========================================
/*

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== PROFILES (extends auth.users) ==========
CREATE TABLE profiles (
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
CREATE TABLE kategori (
  id SERIAL PRIMARY KEY,
  nama_kategori VARCHAR(255) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== SATUAN ==========
CREATE TABLE satuan (
  id SERIAL PRIMARY KEY,
  nama_satuan VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== LOKASI ==========
CREATE TABLE lokasi (
  id SERIAL PRIMARY KEY,
  nama_lokasi VARCHAR(255) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== BARANG ==========
CREATE TABLE barang (
  id SERIAL PRIMARY KEY,
  kode_barang VARCHAR(50) NOT NULL UNIQUE,
  nama_barang VARCHAR(255) NOT NULL,
  id_kategori INT REFERENCES kategori(id) ON DELETE SET NULL,
  id_satuan INT REFERENCES satuan(id) ON DELETE SET NULL,
  id_lokasi INT REFERENCES lokasi(id) ON DELETE SET NULL,
  stok INT NOT NULL DEFAULT 0,
  stok_minimum INT NOT NULL DEFAULT 5,
  foto_url TEXT,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== TRANSAKSI MASUK ==========
CREATE TABLE transaksi_masuk (
  id SERIAL PRIMARY KEY,
  no_dokumen VARCHAR(50) NOT NULL UNIQUE,
  id_barang INT NOT NULL REFERENCES barang(id) ON DELETE CASCADE,
  jumlah INT NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  sumber VARCHAR(50) NOT NULL DEFAULT 'Pembelian',
  no_surat_jalan VARCHAR(100),
  harga_satuan DECIMAL(15,2),
  keterangan TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== TRANSAKSI KELUAR ==========
CREATE TABLE transaksi_keluar (
  id SERIAL PRIMARY KEY,
  no_dokumen VARCHAR(50) NOT NULL UNIQUE,
  id_barang INT NOT NULL REFERENCES barang(id) ON DELETE CASCADE,
  jumlah INT NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tujuan VARCHAR(255) NOT NULL,
  pemohon VARCHAR(255) NOT NULL,
  keterangan TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== LAPORAN BULANAN ==========
CREATE TABLE laporan_bulanan (
  id SERIAL PRIMARY KEY,
  bulan INT NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun INT NOT NULL,
  data_rekapitulasi JSONB NOT NULL DEFAULT '[]',
  generated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bulan, tahun)
);

-- ========== TRIGGER: Auto-update stok on transaksi_masuk ==========
CREATE OR REPLACE FUNCTION update_stok_masuk()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE barang SET stok = stok + NEW.jumlah, updated_at = NOW()
  WHERE id = NEW.id_barang;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stok_masuk
AFTER INSERT ON transaksi_masuk
FOR EACH ROW EXECUTE FUNCTION update_stok_masuk();

-- ========== TRIGGER: Auto-update stok on transaksi_keluar (approved) ==========
CREATE OR REPLACE FUNCTION update_stok_keluar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE barang SET stok = stok - NEW.jumlah, updated_at = NOW()
    WHERE id = NEW.id_barang;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stok_keluar
AFTER INSERT OR UPDATE ON transaksi_keluar
FOR EACH ROW EXECUTE FUNCTION update_stok_keluar();

-- ========== ROW LEVEL SECURITY ==========
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE satuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE lokasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_keluar ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_bulanan ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can read
CREATE POLICY "Authenticated users can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read barang" ON barang FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read kategori" ON kategori FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read satuan" ON satuan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read lokasi" ON lokasi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read transaksi_masuk" ON transaksi_masuk FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read transaksi_keluar" ON transaksi_keluar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read laporan" ON laporan_bulanan FOR SELECT TO authenticated USING (true);

-- Admin-only write policies
CREATE POLICY "Admin can manage barang" ON barang FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage kategori" ON kategori FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage satuan" ON satuan FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage lokasi" ON lokasi FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage transaksi_masuk" ON transaksi_masuk FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert transaksi_keluar" ON transaksi_keluar FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can manage transaksi_keluar" ON transaksi_keluar FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete transaksi_keluar" ON transaksi_keluar FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage laporan" ON laporan_bulanan FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage profiles" ON profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========== SEED DATA ==========
INSERT INTO kategori (nama_kategori, deskripsi) VALUES
  ('Alat Tulis Kantor', 'Perlengkapan tulis menulis dan perkantoran'),
  ('Peralatan Komputer', 'Perangkat keras dan aksesoris komputer'),
  ('Perlengkapan Rumah Tangga', 'Kebutuhan rumah tangga kantor'),
  ('Alat Kebersihan', 'Peralatan untuk kebersihan kantor'),
  ('Perlengkapan Cetakan', 'Formulir, buku, dan cetakan'),
  ('Peralatan Elektronik', 'Perangkat elektronik kantor');

INSERT INTO satuan (nama_satuan) VALUES
  ('Buah'), ('Rim'), ('Lusin'), ('Pak'), ('Dus'), ('Set'),
  ('Unit'), ('Lembar'), ('Roll'), ('Botol'), ('Kotak'), ('Batang');

INSERT INTO lokasi (nama_lokasi, deskripsi) VALUES
  ('Gudang Utama', 'Ruang penyimpanan utama lantai 1'),
  ('Gudang ATK', 'Ruang penyimpanan khusus alat tulis kantor'),
  ('Rak Server', 'Tempat penyimpanan peralatan IT'),
  ('Ruang Arsip', 'Ruang penyimpanan dokumen dan cetakan');

*/
