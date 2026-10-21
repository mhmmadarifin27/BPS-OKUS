// ==========================================
// SIPERSEDIA — Sinkronisasi Master Data (kategori, satuan, lokasi, tim)
// Daftar master diambil/didorong ke Supabase agar sama di semua perangkat.
// ==========================================

export type MasterTipe = 'kategori' | 'satuan' | 'lokasi' | 'tim';

const LOCAL_KEY: Record<MasterTipe, string> = {
  kategori: 'sipersedia_kategori_list',
  satuan: 'sipersedia_satuan_list',
  lokasi: 'sipersedia_lokasi_list',
  tim: 'sipersedia_tim_list',
};

/**
 * Tarik daftar master dari cloud. Bila cloud berisi data, cache lokal
 * di perangkat ini ikut diperbarui (cloud sebagai sumber kebenaran).
 */
export async function fetchAndSyncMaster(tipe: MasterTipe): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/master-data?tipe=${tipe}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    let rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length === 0 || typeof window === 'undefined') return rows;

    // Kategori & lokasi: lengkapi jumlah_barang berdasarkan daftar barang lokal
    // agar tampilan tetap informatif (hitungan tidak ikut dari cloud).
    if (tipe === 'kategori' || tipe === 'lokasi') {
      try {
        const bStr = localStorage.getItem('sipersedia_barang_list');
        const barang = bStr ? JSON.parse(bStr) : [];
        if (Array.isArray(barang)) {
          rows = rows.map((r: any) => ({
            ...r,
            jumlah_barang: barang.filter((b: any) =>
              tipe === 'kategori'
                ? b.kategori?.nama_kategori === r.nama
                : b.lokasi?.nama_lokasi === r.nama
            ).length,
          }));
        }
      } catch {}
    }

    localStorage.setItem(LOCAL_KEY[tipe], JSON.stringify(rows));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('masterDataUpdated', { detail: { tipe, rows } }));
    }
    return rows;
  } catch (e) {
    console.warn(`[MasterSync] Gagal menarik master ${tipe}:`, e);
    return null;
  }
}

/** Kirim (tambah/ubah) satu item master ke cloud — upsert berdasarkan nama. */
export async function pushMasterItem(tipe: MasterTipe, item: any): Promise<boolean> {
  return pushMasterItems(tipe, [item]);
}

/** Kirim beberapa item master sekaligus. */
export async function pushMasterItems(tipe: MasterTipe, items: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/master-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipe, items }),
    });
    return res.ok;
  } catch (e) {
    console.warn(`[MasterSync] Gagal mengirim master ${tipe}:`, e);
    return false;
  }
}

/** Hapus item master di cloud (berdasarkan nama tabel cloud). */
export async function deleteMasterItem(tipe: MasterTipe, opts: { nama?: string; id?: any }): Promise<boolean> {
  try {
    const res = await fetch('/api/master-data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipe, ...opts }),
    });
    return res.ok;
  } catch (e) {
    console.warn(`[MasterSync] Gagal menghapus master ${tipe}:`, e);
    return false;
  }
}

/**
 * Sinkronisasi awal aplikasi (dipanggil saat dashboard dibuka):
 * - Bila cloud berisi daftar → cache lokal diperbarui (semua perangkat seragam).
 * - Bila cloud kosong → data lokal perangkat ini didorong ke cloud (seeding).
 */
export async function syncAllMasterData(): Promise<void> {
  if (typeof window === 'undefined') return;
  const tipes: MasterTipe[] = ['kategori', 'satuan', 'lokasi', 'tim'];

  for (const tipe of tipes) {
    try {
      const rows = await fetchAndSyncMaster(tipe);
      if (!rows || rows.length === 0) {
        // Cloud kosong → dorong isi lokal ke cloud (bootstrap)
        const stored = localStorage.getItem(LOCAL_KEY[tipe]);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await pushMasterItems(tipe, parsed);
            }
          } catch {}
        }
      }
    } catch (e) {
      // Tabel tim_pemohon mungkin belum dibuat — abaikan dengan rapi.
      console.warn(`[MasterSync] Sinkronisasi ${tipe} dilewati:`, e);
    }
  }
}
