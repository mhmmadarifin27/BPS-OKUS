import { NextResponse } from 'next/server';
import { getServiceSupabase, sanitizeBarangFK } from '@/lib/supabase';

// ==========================================================
// API Barang
// - Stok barang dengan riwayat transaksi dihitung dari formula:
//     stok = stok_baseline + (total masuk - total keluar approved)
//   "stok_baseline" adalah titik awal yang diperbarui setiap kali
//   stok diedit manual di aplikasi — sehingga penyesuaian manual
//   TIDAK dikembalikan (revert) oleh perhitungan ulang.
// - Bila kolom stok_baseline belum ada di database (migrasi belum
//   dijalankan), baseline disimpan sementara di tabel laporan_bulanan
//   (bulan 12, tahun 0) sebagai penampung sementara.
// ==========================================================

// Baris penanda baseline sementara memakai (bulan 12, tahun 0) karena kolom bulan
// memiliki CHECK (1..12) di database — dan tak ada laporan asli untuk tahun 0.
const FALLBACK_BULAN = 12;
const FALLBACK_TAHUN = 0;

type MutasiRow = { id_barang?: number; jumlah?: number; status?: string; keterangan?: string | null };

/** Uraikan satu baris transaksi menjadi daftar (barang, jumlah) — mendukung dokumen multi-item. */
function uraiJumlahBarang(row: any): Array<{ barangId: number | null; jumlah: number }> {
  let items: any[] = [];
  if (row.keterangan && typeof row.keterangan === 'string' && row.keterangan.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.keterangan);
      if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
    } catch {}
  }
  if (items.length === 0) {
    return [{ barangId: row.id_barang ?? null, jumlah: Number(row.jumlah) || 0 }];
  }
  return items
    .map((it) => ({ barangId: it.id_barang || it.barang?.id || null, jumlah: Number(it.jumlah) || 0 }));
}

async function hitungNetBarang(supabase: any, barangId: number): Promise<number> {
  const [masukRes, keluarRes] = await Promise.all([
    supabase.from('transaksi_masuk').select('id_barang, jumlah, keterangan'),
    supabase.from('transaksi_keluar').select('id_barang, jumlah, status, keterangan'),
  ]);
  let net = 0;
  for (const t of masukRes.data || []) {
    for (const it of uraiJumlahBarang(t)) {
      if (it.barangId === barangId) net += it.jumlah;
    }
  }
  for (const t of keluarRes.data || []) {
    if (t.status === 'rejected' || t.status === 'pending') continue;
    for (const it of uraiJumlahBarang(t)) {
      if (it.barangId === barangId) net -= it.jumlah;
    }
  }
  return net;
}

/** Ambil peta baseline cadangan dari laporan_bulanan (bulan 12, tahun 0 — bukan laporan asli). */
async function getBaselineFallback(supabase: any): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from('laporan_bulanan')
      .select('data_rekapitulasi')
      .eq('bulan', FALLBACK_BULAN)
      .eq('tahun', FALLBACK_TAHUN)
      .maybeSingle();
    const map = data?.data_rekapitulasi?.stok_baseline;
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

/** Simpan baseline cadangan (kolom stok_baseline belum ada). */
async function setBaselineFallback(supabase: any, barangId: number, baseline: number): Promise<void> {
  let payload: any = { stok_baseline: { [String(barangId)]: baseline } };
  try {
    const existing = await getBaselineFallback(supabase);
    payload = { stok_baseline: { ...existing, [String(barangId)]: baseline } };
  } catch {}
  try {
    await supabase
      .from('laporan_bulanan')
      .upsert(
        { bulan: FALLBACK_BULAN, tahun: FALLBACK_TAHUN, data_rekapitulasi: payload },
        { onConflict: 'bulan,tahun' }
      );
  } catch (e) {
    console.warn('[API Barang] Gagal menyimpan baseline fallback:', e);
  }
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data: barangs, error } = await supabase
      .from('barang')
      .select('*, kategori(id, nama_kategori), satuan(id, nama_satuan), lokasi(id, nama_lokasi)')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!barangs || barangs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const [masukRes, keluarRes, baselineFallback] = await Promise.all([
      supabase.from('transaksi_masuk').select('id_barang, jumlah, keterangan'),
      supabase.from('transaksi_keluar').select('id_barang, jumlah, status, keterangan'),
      getBaselineFallback(supabase),
    ]);

    const inMap: Record<number, number> = {};
    const outMap: Record<number, number> = {};
    (masukRes.data || []).forEach((t: MutasiRow) => {
      for (const it of uraiJumlahBarang(t)) {
        if (it.barangId == null) continue;
        const bId = it.barangId as number;
        inMap[bId] = (inMap[bId] || 0) + it.jumlah;
      }
    });
    (keluarRes.data || []).forEach((t: MutasiRow) => {
      if (t.status === 'rejected' || t.status === 'pending') return;
      for (const it of uraiJumlahBarang(t)) {
        if (it.barangId == null) continue;
        const bId = it.barangId as number;
        outMap[bId] = (outMap[bId] || 0) + it.jumlah;
      }
    });

    // Konsistensi stok: barang yang PUNYA riwayat transaksi dihitung dari
    // baseline + (masuk - keluar). Barang dari Transaksi Masuk tanpa riwayat
    // mutasi otomatis memiliki stok 0 (bukan mempertahankan sisa lama).
    const correctedData = barangs.map((b: any) => {
      const totalIn = inMap[b.id] || 0;
      const totalOut = outMap[b.id] || 0;
      const hasTransactions = inMap[b.id] !== undefined || outMap[b.id] !== undefined;
      const isFromTransaksiMasuk = (b.deskripsi || '').includes('Ditambahkan via Transaksi Masuk');

      if (hasTransactions || isFromTransaksiMasuk || typeof b.stok_baseline === 'number' || baselineFallback[String(b.id)] !== undefined) {
        const baseline =
          typeof b.stok_baseline === 'number'
            ? b.stok_baseline
            : (baselineFallback[String(b.id)] ?? 0);
        const computedStock = Math.max(0, baseline + totalIn - totalOut);
        if (computedStock !== b.stok) {
          // Sinkronkan data di database secara background bila selisih
          supabase.from('barang').update({ stok: computedStock }).eq('id', b.id).then();
        }
        return { ...b, stok: computedStock };
      }
      return b;
    });

    return NextResponse.json({ data: correctedData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceSupabase();

    // Barang sudah ada? (carilah dulu berdasarkan id lalu kode_barang)
    let existing: any = null;
    if (body.id && typeof body.id === 'number') {
      const { data } = await supabase
        .from('barang')
        .select('id, stok, stok_baseline')
        .eq('id', body.id)
        .maybeSingle();
      existing = data;
    }
    if (!existing && body.kode_barang && body.kode_barang !== '-') {
      const { data } = await supabase
        .from('barang')
        .select('id, stok, stok_baseline')
        .eq('kode_barang', body.kode_barang)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      // EDIT barang lewat POST = perbarui bidang master saja; stok & baseline
      // tetap, karena penyesuaian stok wajib lewat PUT agar baseline hitungannya rapi.
      const masterUpdate: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.nama_barang) masterUpdate.nama_barang = body.nama_barang;
      if (body.kode_barang && body.kode_barang !== '-') masterUpdate.kode_barang = body.kode_barang;
      
      const sanitized = await sanitizeBarangFK(supabase, body);
      if (sanitized.id_kategori !== null) masterUpdate.id_kategori = sanitized.id_kategori;
      if (sanitized.id_satuan !== null) masterUpdate.id_satuan = sanitized.id_satuan;
      if (sanitized.id_lokasi !== null) masterUpdate.id_lokasi = sanitized.id_lokasi;

      if (typeof body.stok_minimum === 'number') masterUpdate.stok_minimum = body.stok_minimum;
      if (body.deskripsi !== undefined) masterUpdate.deskripsi = body.deskripsi;
      if (body.foto_url !== undefined) masterUpdate.foto_url = body.foto_url;

      if (Object.keys(masterUpdate).length > 1) {
        const { data, error } = await supabase
          .from('barang')
          .update(masterUpdate)
          .eq('id', existing.id)
          .select();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, data });
      }
      return NextResponse.json({ success: true, data: [existing] });
    }

    // BARANG BARU: stok awal = titik awal (baseline) ledger
    const sanitized = await sanitizeBarangFK(supabase, body);
    const stokAwal = Number(body.stok) || 0;
    const payload: any = {
      kode_barang: body.kode_barang,
      nama_barang: body.nama_barang,
      id_kategori: sanitized.id_kategori,
      id_satuan: sanitized.id_satuan,
      id_lokasi: sanitized.id_lokasi,
      stok: stokAwal,
      stok_minimum: typeof body.stok_minimum === 'number' ? body.stok_minimum : 5,
      foto_url: body.foto_url || null,
      deskripsi: body.deskripsi || null,
      updated_at: new Date().toISOString(),
    };
    if (body.id && typeof body.id === 'number') payload.id = body.id;
    payload.stok_baseline = stokAwal;

    let { data, error } = await supabase.from('barang').upsert(payload, { onConflict: 'kode_barang' }).select();

    // Kolom stok_baseline belum ada (migrasi belum jalan) → coba tanpa kolom itu
    if (error && String(error.message || '').toLowerCase().includes('stok_baseline')) {
      delete payload.stok_baseline;
      ({ data, error } = await supabase.from('barang').upsert(payload, { onConflict: 'kode_barang' }).select());
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceSupabase();

    if (!body.id) {
      return NextResponse.json({ error: 'Parameter id dibutuhkan' }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (body.nama_barang) updateData.nama_barang = body.nama_barang;
    if (body.kode_barang && body.kode_barang !== '-') updateData.kode_barang = body.kode_barang;
    if (typeof body.stok_minimum === 'number') updateData.stok_minimum = body.stok_minimum;
    if (body.deskripsi !== undefined) updateData.deskripsi = body.deskripsi;
    if (body.foto_url !== undefined) updateData.foto_url = body.foto_url;

    const sanitized = await sanitizeBarangFK(supabase, body);
    if (body.id_kategori !== undefined || body.kategori !== undefined) updateData.id_kategori = sanitized.id_kategori;
    if (body.id_satuan !== undefined || body.satuan !== undefined) updateData.id_satuan = sanitized.id_satuan;
    if (body.id_lokasi !== undefined || body.lokasi !== undefined) updateData.id_lokasi = sanitized.id_lokasi;

    const net = await hitungNetBarang(supabase, body.id);

    if (typeof body.stok === 'number') {
      const stokBaru = Math.max(0, body.stok);
      updateData.stok = stokBaru;
      // Penyesuaian manual = titik awal baru: stok = baseline + (masuk - keluar)
      const baselineBaru = Math.max(0, stokBaru - net);
      updateData.stok_baseline = baselineBaru;
    }

    let { data, error } = await supabase.from('barang').update(updateData).eq('id', body.id).select();

    // Fallback bila kolom stok_baseline belum dijalankan migrasinya
    if (error && updateData.stok_baseline !== undefined && String(error.message || '').toLowerCase().includes('stok_baseline')) {
      await setBaselineFallback(supabase, body.id, updateData.stok_baseline);
      delete updateData.stok_baseline;
      ({ data, error } = await supabase.from('barang').update(updateData).eq('id', body.id).select());
    }

    if (error) {
      console.error('[API Barang PUT Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const kode_barang = searchParams.get('kode_barang');
    const clear_all = searchParams.get('clear_all');

    const supabase = getServiceSupabase();

    if (clear_all === 'true') {
      const { error } = await supabase.from('barang').delete().neq('id', 0);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Semua data barang berhasil dikosongkan' });
    }

    let query = supabase.from('barang').delete();
    if (id) {
      query = query.eq('id', Number(id));
    } else if (kode_barang) {
      query = query.eq('kode_barang', kode_barang);
    } else {
      return NextResponse.json({ error: 'Parameter id atau kode_barang dibutuhkan' }, { status: 400 });
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
