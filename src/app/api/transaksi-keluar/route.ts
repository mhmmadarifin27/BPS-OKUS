import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('transaksi_keluar')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceSupabase();

    const items = body.items && Array.isArray(body.items) && body.items.length > 0 ? body.items : [];
    let primaryIdBarang = body.id_barang || (items[0]?.id_barang);

    // 1. Pastikan setiap barang di items tersimpan di tabel 'barang' agar tidak kena Foreign Key constraint
    for (const item of items) {
      const bId = item.id_barang || item.barang?.id;
      if (bId) {
        const { data: existingB } = await supabase.from('barang').select('id, stok').eq('id', bId).maybeSingle();
        if (!existingB) {
          const bInfo = item.barang || {};
          await supabase.from('barang').upsert({
            id: bId,
            kode_barang: bInfo.kode_barang || `000${bId}`,
            nama_barang: bInfo.nama_barang || `Barang ${bId}`,
            id_kategori: bInfo.id_kategori || 1,
            id_satuan: bInfo.id_satuan || 1,
            id_lokasi: bInfo.id_lokasi || 1,
            stok: typeof bInfo.stok === 'number' ? bInfo.stok : 0,
            stok_minimum: typeof bInfo.stok_minimum === 'number' ? bInfo.stok_minimum : 5,
            deskripsi: bInfo.deskripsi || null,
            updated_at: new Date().toISOString(),
          });
        }
        if (!primaryIdBarang) primaryIdBarang = bId;
      }
    }

    // 2. Pastikan primaryIdBarang benar-benar ada di tabel barang
    if (primaryIdBarang) {
      const { data: checkPrimary } = await supabase.from('barang').select('id').eq('id', primaryIdBarang).maybeSingle();
      if (!checkPrimary) {
        const fallbackName = items[0]?.barang?.nama_barang || `Barang ${primaryIdBarang}`;
        const fallbackKode = items[0]?.barang?.kode_barang || `000${primaryIdBarang}`;
        await supabase.from('barang').upsert({
          id: primaryIdBarang,
          kode_barang: fallbackKode,
          nama_barang: fallbackName,
          id_kategori: 1,
          id_satuan: 1,
          id_lokasi: 1,
          stok: 0,
          stok_minimum: 5,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      const { data: anyB } = await supabase.from('barang').select('id').limit(1).maybeSingle();
      if (anyB) {
        primaryIdBarang = anyB.id;
      } else {
        const { data: createdB } = await supabase.from('barang').insert({
          id: 1,
          kode_barang: '000001',
          nama_barang: 'Stabillo',
          id_kategori: 1,
          id_satuan: 1,
          id_lokasi: 1,
          stok: 10,
          stok_minimum: 5,
        }).select('id').single();
        primaryIdBarang = createdB?.id || 1;
      }
    }

    // Map payload into columns existing in Supabase table
    const payload = {
      no_dokumen: body.no_dokumen,
      id_barang: primaryIdBarang,
      jumlah: body.jumlah || (items.reduce((s: number, i: any) => s + (i.jumlah || 0), 0)) || 1,
      tanggal: body.tanggal || new Date().toISOString().split('T')[0],
      tujuan: body.nama_tim || body.tujuan || 'Kantor BPS',
      pemohon: body.penanggung_jawab || body.pemohon || 'Pegawai',
      status: body.status || 'pending',
      keterangan: typeof body.keterangan === 'string' && body.keterangan.startsWith('{')
        ? body.keterangan
        : JSON.stringify({
            note: body.keterangan || '',
            jenis_pengeluaran: body.jenis_pengeluaran || 'habis_pakai',
            tim_pemohon: body.tim_pemohon || 'tim-sosial',
            nama_tim: body.nama_tim || 'Tim Sosial',
            penanggung_jawab: body.penanggung_jawab || 'Pegawai',
            nip_pj: body.nip_pj || '-',
            items: items,
          }),
    };

    const { data, error } = await supabase
      .from('transaksi_keluar')
      .upsert(payload, { onConflict: 'no_dokumen' })
      .select();

    if (error) {
      console.error('[API Transaksi Keluar Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[API Transaksi Keluar Catch Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const no_dokumen = searchParams.get('no_dokumen');
    const id = searchParams.get('id');
    const clear_all = searchParams.get('clear_all');

    const supabase = getServiceSupabase();

    if (clear_all === 'true') {
      const { error } = await supabase.from('transaksi_keluar').delete().neq('id', 0);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Semua transaksi keluar berhasil dikosongkan' });
    }

    let query = supabase.from('transaksi_keluar').delete();

    if (no_dokumen) {
      query = query.eq('no_dokumen', no_dokumen);
    } else if (id) {
      query = query.eq('id', Number(id));
    } else {
      return NextResponse.json({ error: 'Parameter no_dokumen atau id dibutuhkan' }, { status: 400 });
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
