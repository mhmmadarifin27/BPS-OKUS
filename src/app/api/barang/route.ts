import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data: barangs, error } = await supabase
      .from('barang')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!barangs || barangs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Ambil mutasi masuk dan keluar untuk menjamin konsistensi stok dengan buku ledger laporan
    const [masukRes, keluarRes] = await Promise.all([
      supabase.from('transaksi_masuk').select('id_barang, jumlah, keterangan'),
      supabase.from('transaksi_keluar').select('id_barang, jumlah, status, keterangan'),
    ]);

    const inMap: Record<number, number> = {};
    const outMap: Record<number, number> = {};

    (masukRes.data || []).forEach((t: any) => {
      let items: any[] = [];
      if (t.keterangan && typeof t.keterangan === 'string' && t.keterangan.startsWith('{')) {
        try {
          const parsed = JSON.parse(t.keterangan);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
        } catch {}
      }
      if (items.length === 0) items = [{ id_barang: t.id_barang, jumlah: t.jumlah }];
      items.forEach((it) => {
        const bId = it.id_barang || it.barang?.id;
        if (bId) inMap[bId] = (inMap[bId] || 0) + (Number(it.jumlah) || 0);
      });
    });

    (keluarRes.data || []).forEach((t: any) => {
      if (t.status === 'rejected' || t.status === 'pending') return;
      let items: any[] = [];
      if (t.keterangan && typeof t.keterangan === 'string' && t.keterangan.startsWith('{')) {
        try {
          const parsed = JSON.parse(t.keterangan);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
        } catch {}
      }
      if (items.length === 0) items = [{ id_barang: t.id_barang, jumlah: t.jumlah }];
      items.forEach((it) => {
        const bId = it.id_barang || it.barang?.id;
        if (bId) outMap[bId] = (outMap[bId] || 0) + (Number(it.jumlah) || 0);
      });
    });

    // Reconcile stok: jika barang memiliki mutasi masuk, hitung dari mutasi (masuk - keluar approved)
    const correctedData = barangs.map((b) => {
      const totalIn = inMap[b.id];
      const totalOut = outMap[b.id] || 0;
      if (totalIn !== undefined) {
        // ponytail: Jika barang punya riwayat transaksi masuk, stok = masuk - keluar approved. Upgrade path: snapshot bulanan
        const computedStock = Math.max(0, totalIn - totalOut);
        if (computedStock !== b.stok) {
          // Sinkronkan data di database secara background jika terjadi selisih
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

    const payload: any = {
      kode_barang: body.kode_barang,
      nama_barang: body.nama_barang,
      id_kategori: body.id_kategori || null,
      id_satuan: body.id_satuan || null,
      id_lokasi: body.id_lokasi || null,
      stok: typeof body.stok === 'number' ? body.stok : 0,
      stok_minimum: typeof body.stok_minimum === 'number' ? body.stok_minimum : 5,
      foto_url: body.foto_url || null,
      deskripsi: body.deskripsi || null,
      updated_at: new Date().toISOString(),
    };

    if (body.id && typeof body.id === 'number') {
      payload.id = body.id;
    }

    const { data, error } = await supabase
      .from('barang')
      .upsert(payload, { onConflict: 'kode_barang' })
      .select();

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
    if (typeof body.stok === 'number') updateData.stok = body.stok;
    if (body.nama_barang) updateData.nama_barang = body.nama_barang;
    if (typeof body.stok_minimum === 'number') updateData.stok_minimum = body.stok_minimum;
    if (body.deskripsi !== undefined) updateData.deskripsi = body.deskripsi;

    const { data, error } = await supabase
      .from('barang')
      .update(updateData)
      .eq('id', body.id)
      .select();

    if (error) {
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
