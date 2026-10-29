import { NextResponse } from 'next/server';
import { getServiceSupabase, sanitizeBarangFK } from '@/lib/supabase';

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
          const sanitized = await sanitizeBarangFK(supabase, bInfo);
          await supabase.from('barang').upsert({
            id: bId,
            kode_barang: bInfo.kode_barang || `000${bId}`,
            nama_barang: bInfo.nama_barang || `Barang ${bId}`,
            id_kategori: sanitized.id_kategori,
            id_satuan: sanitized.id_satuan,
            id_lokasi: sanitized.id_lokasi,
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
        const sanitized = await sanitizeBarangFK(supabase, items[0]?.barang || {});
        await supabase.from('barang').upsert({
          id: primaryIdBarang,
          kode_barang: fallbackKode,
          nama_barang: fallbackName,
          id_kategori: sanitized.id_kategori,
          id_satuan: sanitized.id_satuan,
          id_lokasi: sanitized.id_lokasi,
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
        const sanitized = await sanitizeBarangFK(supabase, {});
        const { data: createdB } = await supabase.from('barang').insert({
          id: 1,
          kode_barang: '000001',
          nama_barang: 'Barang Uji',
          id_kategori: sanitized.id_kategori,
          id_satuan: sanitized.id_satuan,
          id_lokasi: sanitized.id_lokasi,
          stok: 10,
          stok_minimum: 5,
        }).select('id').single();
        primaryIdBarang = createdB?.id || 1;
      }
    }

    let docNo = body.no_dokumen;

    // Cek apakah no_dokumen ini sudah ada di database
    const { data: existingDoc } = await supabase
      .from('transaksi_keluar')
      .select('id, no_dokumen, status, pemohon')
      .eq('no_dokumen', docNo)
      .maybeSingle();

    if (existingDoc) {
      const isStatusUpdate = Boolean(body.status && body.status !== existingDoc.status);
      const isSameRecord = Boolean(body.id && String(body.id) === String(existingDoc.id));
      const isForcedUpdate = Boolean(body.force_update);

      if (isStatusUpdate || isSameRecord || isForcedUpdate) {
        // Pembaruan status (approval / rejection / edit) pada dokumen yang sama
        const updateData: any = {
          status: body.status || existingDoc.status,
        };
        if (body.approved_by) updateData.approved_by = body.approved_by;
        // Edit dokumen (mis. perbaikan Penanggung Jawab / tim pemohon)
        if (body.tanggal) updateData.tanggal = body.tanggal;
        if (body.nama_tim) updateData.tujuan = body.nama_tim;
        if (body.penanggung_jawab) updateData.pemohon = body.penanggung_jawab;
        if (Array.isArray(body.items) && body.items.length > 0) {
          // Pertahankan metadata dokumen lengkap (items multi-barang, jenis, PJ, dll.)
          updateData.keterangan = JSON.stringify({
            note: body.keterangan || '',
            jenis_pengeluaran: body.jenis_pengeluaran || 'habis_pakai',
            tim_pemohon: body.tim_pemohon || 'tim-sosial',
            nama_tim: body.nama_tim || 'Tim Sosial',
            penanggung_jawab: body.penanggung_jawab || 'Pegawai',
            nip_pj: body.nip_pj || '-',
            items: body.items,
          });
        } else if (body.keterangan) {
          updateData.keterangan = typeof body.keterangan === 'string'
            ? body.keterangan
            : JSON.stringify(body.keterangan);
        }
        const { data, error } = await supabase
          .from('transaksi_keluar')
          .update(updateData)
          .eq('no_dokumen', docNo)
          .select();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, data });
      }

      // Dokumen baru yang konflik nomornya karena 2+ user menginput bersamaan:
      // Naikkan nomor urut otomatis agar permintaan user ini tidak menimpa user lain!
      const { data: allDocs } = await supabase
        .from('transaksi_keluar')
        .select('no_dokumen');
      const existingSet = new Set((allDocs || []).map((x: any) => x.no_dokumen));
      const d = new Date(body.tanggal || new Date());
      const prefix = `BK-${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/`;
      let seq = 1;
      while (existingSet.has(`${prefix}${String(seq).padStart(3, '0')}`)) {
        seq++;
      }
      docNo = `${prefix}${String(seq).padStart(3, '0')}`;
    }

    // Map payload into columns existing in Supabase table
    const payload = {
      no_dokumen: docNo,
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
