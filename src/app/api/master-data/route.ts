import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// ==========================================================
// API Master Data: kategori, satuan, lokasi, tim (pemohon)
// Memungkinkan daftar master tersinkron antar perangkat
// lewat Supabase (cloud sebagai sumber kebenaran).
// ==========================================================

type MasterTipe = 'kategori' | 'satuan' | 'lokasi' | 'tim';

interface TableConf {
  table: string;
  nameCol: string;
  descCol: string | null;
}

const CONF: Record<MasterTipe, TableConf> = {
  kategori: { table: 'kategori', nameCol: 'nama_kategori', descCol: 'deskripsi' },
  satuan: { table: 'satuan', nameCol: 'nama_satuan', descCol: null },
  lokasi: { table: 'lokasi', nameCol: 'nama_lokasi', descCol: 'deskripsi' },
  tim: { table: 'tim_pemohon', nameCol: 'nama_tim', descCol: null },
};

// Bentuk lokal <-> bentuk cloud
function toLocal(tipe: MasterTipe, row: any): any {
  const conf = CONF[tipe];
  if (tipe === 'tim') {
    return {
      id: row.id,
      nama_tim: row.nama_tim,
      penanggung_jawab: row.penanggung_jawab || '',
      nip_pj: row.nip_pj || '',
    };
  }
  const base: any = { id: row.id };
  if (conf.descCol) base.deskripsi = row.deskripsi || null;
  if (tipe === 'kategori') base.nama = row.nama_kategori;
  else base.nama = row.nama_satuan ?? row.nama_lokasi;
  if (tipe !== 'satuan') {
    if (row.jumlah_barang !== undefined && row.jumlah_barang !== null) base.jumlah_barang = row.jumlah_barang;
    else base.jumlah_barang = 0;
  }
  return base;
}

function toCloud(tipe: MasterTipe, item: any): any | null {
  const conf = CONF[tipe];
  if (tipe === 'tim') {
    const namaTim = (item.nama_tim || '').trim();
    if (!namaTim) return null;
    const payload: any = { nama_tim: namaTim };
    if (item.penanggung_jawab) payload.penanggung_jawab = item.penanggung_jawab;
    if (item.nip_pj) payload.nip_pj = item.nip_pj;
    return payload;
  }
  const nama = (item.nama || '').trim();
  if (!nama) return null;
  const payload: any = { [conf.nameCol]: nama };
  if (conf.descCol) payload[conf.descCol] = item.deskripsi?.trim() || null;
  return payload;
}

function mapAll(tipe: MasterTipe, rows: any[] | null): any[] {
  return (rows || []).map((r) => toLocal(tipe, r));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipe = (searchParams.get('tipe') || '') as MasterTipe;
  if (!CONF[tipe]) {
    return NextResponse.json({ error: 'Parameter tipe tidak valid' }, { status: 400 });
  }
  try {
    const supabase = getServiceSupabase();
    const conf = CONF[tipe];
    const { data, error } = await supabase
      .from(conf.table)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data: mapAll(tipe, data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tipe = (body.tipe || '') as MasterTipe;
    if (!CONF[tipe]) {
      return NextResponse.json({ error: 'Parameter tipe tidak valid' }, { status: 400 });
    }
    const conf = CONF[tipe];
    const incoming: any[] = Array.isArray(body.items) && body.items.length > 0 ? body.items : body.item ? [body.item] : [];
    const payloads = incoming.map((i) => toCloud(tipe, i)).filter(Boolean);
    if (payloads.length === 0) {
      return NextResponse.json({ error: 'Item tidak valid (nama kosong)' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from(conf.table)
      .upsert(payloads, { onConflict: conf.nameCol })
      .select();

    if (error) {
      console.error(`[API Master Data ${tipe}] Upsert gagal:`, error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: mapAll(tipe, data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const tipe = (body.tipe || '') as MasterTipe;
    if (!CONF[tipe]) {
      return NextResponse.json({ error: 'Parameter tipe tidak valid' }, { status: 400 });
    }
    const conf = CONF[tipe];
    const supabase = getServiceSupabase();

    let query = supabase.from(conf.table).delete();
    if (body.id !== undefined && body.id !== null) {
      query = query.eq('id', body.id);
    } else if (body.nama) {
      query = query.eq(conf.nameCol, body.nama);
    } else {
      return NextResponse.json({ error: 'Parameter id atau nama dibutuhkan' }, { status: 400 });
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
