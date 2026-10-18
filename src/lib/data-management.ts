// ==========================================
// SIPERSEDIA - Data Management & Reset Store
// Memastikan data aplikasi selalu siap untuk uji coba fitur per fitur
// ==========================================

import { ALL_81_BARANG_BPS, SAMPLE_TRANSAKSI_MASUK, SAMPLE_TRANSAKSI_KELUAR } from './mock-data';

export const DATA_STORE_VERSION = 'v20261012_lean_6_clean';

/**
 * Inisialisasi otomatis pada awal aplikasi dimuat.
 * Jika versi data belum sesuai, otomatis reset ke mode uji coba bersih (6 master barang perwakilan, 0 transaksi).
 */
export function initOrMigrateStore(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const existingBarang = localStorage.getItem('sipersedia_barang_list');
    if (!existingBarang) {
      localStorage.setItem('sipersedia_barang_list', JSON.stringify(ALL_81_BARANG_BPS));
    }

    const existingMasuk = localStorage.getItem('sipersedia_transaksi_masuk');
    if (!existingMasuk) {
      localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify([]));
    }

    const existingKeluar = localStorage.getItem('sipersedia_transaksi_keluar');
    if (!existingKeluar) {
      localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify([]));
    }

    const existingKategori = localStorage.getItem('sipersedia_kategori_list');
    if (!existingKategori) {
      localStorage.setItem('sipersedia_kategori_list', JSON.stringify([
        { id: 1, nama: 'Alat Tulis Kantor', deskripsi: 'Perlengkapan tulis perkantoran', jumlah_barang: 3 },
        { id: 2, nama: 'Peralatan Komputer', deskripsi: 'Perangkat keras dan aksesoris komputer', jumlah_barang: 1 },
        { id: 3, nama: 'Perlengkapan Cetakan', deskripsi: 'Formulir, buku, dan cetakan dinas', jumlah_barang: 1 },
        { id: 4, nama: 'Perlengkapan Lapangan', deskripsi: 'Perlengkapan sensus & survei lapangan', jumlah_barang: 1 },
      ]));
    }

    const existingSatuan = localStorage.getItem('sipersedia_satuan_list');
    if (!existingSatuan) {
      localStorage.setItem('sipersedia_satuan_list', JSON.stringify([
        { id: 1, nama: 'Buah' },
        { id: 2, nama: 'Rim' },
        { id: 3, nama: 'Kotak' },
        { id: 4, nama: 'Unit' },
        { id: 5, nama: 'Lusin' },
      ]));
    }

    const existingLokasi = localStorage.getItem('sipersedia_lokasi_list');
    if (!existingLokasi) {
      localStorage.setItem('sipersedia_lokasi_list', JSON.stringify([
        { id: 1, nama: 'Gudang ATK', deskripsi: 'Ruang penyimpanan khusus alat tulis kantor', jumlah_barang: 3 },
        { id: 2, nama: 'Rak Server', deskripsi: 'Tempat penyimpanan peralatan IT', jumlah_barang: 1 },
        { id: 3, nama: 'Ruang Arsip', deskripsi: 'Ruang penyimpanan dokumen dan cetakan', jumlah_barang: 1 },
        { id: 4, nama: 'Gudang Utama', deskripsi: 'Ruang penyimpanan utama lantai 1', jumlah_barang: 1 },
      ]));
    }

    localStorage.setItem('sipersedia_data_version', DATA_STORE_VERSION);
    return true;
  } catch (e) {
    console.error('[SIPERSEDIA] Gagal inisialisasi data store:', e);
  }
  return false;
}

/**
 * Reset ke mode Uji Coba Bersih:
 * - 81 Barang BPS siap digunakan (stok baseline awal)
 * - 0 Transaksi Masuk
 * - 0 Transaksi Keluar
 * - Mutasi kartu kendali bersih siap menerima input baru
 */
export function resetToTestingMode(): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('sipersedia_barang_list', JSON.stringify(ALL_81_BARANG_BPS));
  localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify([]));
  localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify([]));
  localStorage.setItem('sipersedia_data_version', DATA_STORE_VERSION);

  // Bersihkan cache laporan kustom
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sipersedia_laporan_data_')) {
      localStorage.removeItem(key);
    }
  });

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('dataStoreReset', { detail: { mode: 'testing' } }));
}

/**
 * Muat data simulasi lengkap (81 barang + transaksi contoh).
 */
export function loadSimulationData(): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('sipersedia_barang_list', JSON.stringify(ALL_81_BARANG_BPS));
  localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify(SAMPLE_TRANSAKSI_MASUK));
  localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify(SAMPLE_TRANSAKSI_KELUAR));
  localStorage.setItem('sipersedia_data_version', DATA_STORE_VERSION);

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('dataStoreReset', { detail: { mode: 'simulation' } }));
}

/**
 * Kosongkan seluruh data (0 barang & 0 transaksi) untuk menguji formulir master dari nol.
 */
export function wipeAllData(): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('sipersedia_barang_list', JSON.stringify([]));
  localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify([]));
  localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify([]));
  localStorage.setItem('sipersedia_data_version', DATA_STORE_VERSION);

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sipersedia_laporan_data_')) {
      localStorage.removeItem(key);
    }
  });

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('dataStoreReset', { detail: { mode: 'wipe' } }));
}
