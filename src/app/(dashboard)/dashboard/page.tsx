'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  PlusCircle,
  FileText,
  Boxes,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  ShoppingBag,
  Info,
  Calendar,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import StatsCard from '@/components/StatsCard';
import { mockChartData, mockBarang } from '@/lib/mock-data';
import type { Barang, TransaksiMasuk, TransaksiKeluar } from '@/types';
import { formatNumber, formatDateShort, cn } from '@/lib/utils';
import {
  fetchAndSyncBarang,
  fetchAndSyncTransaksiKeluar,
  fetchAndSyncTransaksiMasuk,
} from '@/lib/sync-service';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: 'admin' | 'user';
    bidang: string;
  } | null>(null);

  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [transaksiMasukList, setTransaksiMasukList] = useState<TransaksiMasuk[]>([]);
  const [transaksiKeluarList, setTransaksiKeluarList] = useState<TransaksiKeluar[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('sipersedia_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }

    const b = localStorage.getItem('sipersedia_barang_list');
    if (b !== null) {
      try {
        const parsed = JSON.parse(b);
        if (Array.isArray(parsed)) {
          setBarangList(parsed);
        }
      } catch (e) {
        setBarangList([]);
      }
    } else {
      setBarangList(mockBarang);
    }

    const m = localStorage.getItem('sipersedia_transaksi_masuk');
    if (m) {
      try {
        const parsed = JSON.parse(m);
        if (Array.isArray(parsed)) setTransaksiMasukList(parsed);
      } catch (e) {}
    }

    const k = localStorage.getItem('sipersedia_transaksi_keluar');
    if (k) {
      try {
        const parsed = JSON.parse(k);
        if (Array.isArray(parsed)) setTransaksiKeluarList(parsed);
      } catch (e) {}
    }

    // Sinkronisasi otomatis data terbaru dari cloud
    let curBarang = mockBarang;
    fetchAndSyncBarang().then((bData) => {
      if (bData && bData.length > 0) {
        curBarang = bData;
        setBarangList(bData);
      }
    });
    fetchAndSyncTransaksiMasuk(curBarang).then((mData) => {
      if (mData) setTransaksiMasukList(mData);
    });
    fetchAndSyncTransaksiKeluar(curBarang).then((kData) => {
      if (kData) setTransaksiKeluarList(kData);
    });

    // Polling setiap 7 detik
    const syncInterval = setInterval(() => {
      fetchAndSyncBarang().then((bData) => {
        if (bData && bData.length > 0) setBarangList(bData);
      });
      fetchAndSyncTransaksiMasuk(curBarang).then((mData) => {
        if (mData) setTransaksiMasukList(mData);
      });
      fetchAndSyncTransaksiKeluar(curBarang).then((kData) => {
        if (kData) setTransaksiKeluarList(kData);
      });
    }, 7000);

    return () => clearInterval(syncInterval);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Perhitungan Data Keseluruhan (Admin)
  const totalBarang = barangList.length;
  const totalTransaksiMasuk = transaksiMasukList.length;
  const totalTransaksiKeluar = transaksiKeluarList.length;
  const totalPendingSPB = transaksiKeluarList.filter(t => t.status === 'pending').length;

  // Perhitungan Data Khusus Pegawai (Sesuai Tim atau Pengajuan User)
  const userTimLower = (currentUser?.bidang || '').toLowerCase();
  const userNameLower = (currentUser?.name || '').toLowerCase();

  const myRequests = transaksiKeluarList.filter(t => {
    if (isAdmin) return true;
    const timMatch = userTimLower && (t.tim_pemohon || t.nama_tim || '').toLowerCase().includes(userTimLower);
    const nameMatch = userNameLower && (t.penanggung_jawab || t.created_by || '').toLowerCase().includes(userNameLower);
    return timMatch || nameMatch;
  });

  const myPendingCount = myRequests.filter(t => t.status === 'pending').length;
  const myApprovedCount = myRequests.filter(t => t.status === 'approved' || !t.status).length;
  const myRejectedCount = myRequests.filter(t => t.status === 'rejected').length;

  const chartData = mockChartData;

  return (
    <div className="page-enter space-y-6">
      {/* Institutional BPS Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl border border-bps-blue-700/30 bg-gradient-to-r from-[#005AA9] via-[#004887] to-[#E65100] text-white">
        {/* Glowing Orbs Aksen BPS */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-bps-orange/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 right-1/4 w-72 h-72 rounded-full bg-bps-green/25 blur-3xl pointer-events-none" />

        {/* Pita Aksen Tricolor Resmi BPS */}
        <div className="h-1.5 w-full bg-gradient-to-r from-bps-blue via-bps-orange to-bps-green" />

        <div className="p-6 sm:p-7 relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            {/* Logo BPS */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-xl ring-4 ring-bps-orange/30 flex-shrink-0">
              <img
                src="/images/logo-bps.svg"
                alt="Logo Badan Pusat Statistik"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/25 backdrop-blur-md">
                  BADAN PUSAT STATISTIK
                </span>
                <span className="text-[10px] font-extrabold text-amber-300 px-2.5 py-0.5 rounded-full bg-black/25 border border-amber-300/30">
                  KABUPATEN OKU SELATAN
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                SIMPAN OKUS · GUDANG PERSEDIAAN BPS
              </h1>
              <p className="text-[11px] font-bold text-amber-200 tracking-wide uppercase">
                SISTEM INFORMASI MANAJEMEN PERSEDIAAN
              </p>

              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed pt-0.5">
                {isAdmin ? (
                  <>
                    Selamat datang, <span className="font-bold text-white">{currentUser?.name || 'Administrator'}</span>! Anda berada di mode <span className="font-bold text-amber-300">Admin Persediaan</span> untuk mengelola stok persediaan, input barang masuk, dan persetujuan SPB.
                  </>
                ) : (
                  <>
                    Selamat datang, <span className="font-bold text-white">{currentUser?.name || 'Pegawai BPS'}</span>! Anda berada di mode <span className="font-bold text-emerald-300">Pegawai</span> untuk melihat ketersediaan stok ATK dan mengajukan permintaan barang.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons sesuai Role */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {isAdmin ? (
              <>
                <Link
                  href="/transaksi-masuk"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-bps-green to-bps-green-600 text-white shadow-md hover:brightness-105 transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Catat Barang Masuk</span>
                </Link>
                <Link
                  href="/barang"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm transition-all active:scale-95"
                >
                  <Boxes className="w-4 h-4" />
                  <span>Master Barang</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/transaksi-keluar"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-bps-orange to-bps-orange-600 text-white shadow-md hover:brightness-105 transition-all active:scale-95"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  <span>Ajukan Permintaan SPB</span>
                </Link>
                <Link
                  href="/barang"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm transition-all active:scale-95"
                >
                  <Package className="w-4 h-4" />
                  <span>Katalog & Sisa Stok</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. TAMPILAN KHUSUS ADMIN PERSEDIAAN */}
      {/* ======================================================== */}
      {isAdmin ? (
        <div className="space-y-6">
          {/* Stats Cards Admin (4 Kartu) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <StatsCard
                title="Total Master Barang"
                value={formatNumber(totalBarang)}
                subtitle="item terdaftar di gudang"
                icon={<Package className="w-5 h-5 text-white" />}
                variant="blue"
                delay={0}
              />
            </div>
            <div>
              <StatsCard
                title="Transaksi Masuk"
                value={formatNumber(totalTransaksiMasuk)}
                subtitle="dokumen penerimaan barang"
                icon={<ArrowDownToLine className="w-5 h-5 text-white" />}
                variant="green"
                delay={100}
              />
            </div>
            <div>
              <StatsCard
                title="Transaksi Keluar (SPB)"
                value={formatNumber(totalTransaksiKeluar)}
                subtitle="total permohonan pegawai"
                icon={<ArrowUpFromLine className="w-5 h-5 text-white" />}
                variant="orange"
                delay={200}
              />
            </div>
            <div>
              <StatsCard
                title="SPB Menunggu Verifikasi"
                value={formatNumber(totalPendingSPB)}
                subtitle={totalPendingSPB > 0 ? "perlu persetujuan admin" : "semua SPB sudah diverifikasi"}
                icon={<Clock className="w-5 h-5 text-white" />}
                variant="orange"
                trend={totalPendingSPB > 0 ? { value: totalPendingSPB, direction: 'up' } : undefined}
                delay={300}
              />
            </div>
          </div>

          {/* Chart Trend Arus Barang Masuk & Keluar */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-dark-800">Trend Barang Masuk & Keluar</h2>
                <p className="text-xs text-dark-400 mt-0.5">Statistik arus persediaan barang 6 bulan terakhir</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-bps-blue shadow-xs" />
                  <span className="text-dark-600">Barang Masuk (Biru)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-bps-orange shadow-xs" />
                  <span className="text-dark-600">Barang Keluar (Orange)</span>
                </div>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <defs>
                    <linearGradient id="gradMasuk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#005AA9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#005AA9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradKeluar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5821F" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#F5821F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="masuk" stroke="#005AA9" strokeWidth={2.5} fill="url(#gradMasuk)" name="Barang Masuk" />
                  <Area type="monotone" dataKey="keluar" stroke="#F5821F" strokeWidth={2.5} fill="url(#gradKeluar)" name="Barang Keluar" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pemakaian Barang Terbaru Admin */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between bg-dark-50/40">
              <div>
                <h2 className="text-base font-bold text-dark-800">Permintaan & Pengeluaran Barang Terbaru</h2>
                <p className="text-xs text-dark-400 mt-0.5">Daftar permohonan SPB dari seluruh tim pegawai</p>
              </div>
              <Link
                href="/transaksi-keluar"
                className="text-xs text-bps-blue font-bold hover:text-bps-blue-700 flex items-center gap-1 transition-colors"
              >
                Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="table-container border-0">
              <table>
                <thead>
                  <tr>
                    <th>No. Dokumen SPB</th>
                    <th>Tanggal</th>
                    <th>Barang Diminta</th>
                    <th>Tim Pemohon</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksiKeluarList.slice(0, 5).map((trx) => (
                    <tr key={trx.id}>
                      <td>
                        <span className="font-mono text-xs text-bps-blue font-bold">{trx.no_dokumen}</span>
                      </td>
                      <td className="text-xs text-dark-500">{formatDateShort(trx.tanggal)}</td>
                      <td>
                        <div className="space-y-0.5">
                          {trx.items.map((item, idx) => (
                            <p key={idx} className="text-xs text-dark-700 font-medium">
                              {item.barang?.nama_barang} ({item.jumlah} {item.barang?.satuan?.nama_satuan || 'Buah'})
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm text-dark-700 font-semibold">{trx.nama_tim}</td>
                      <td>
                        <span className={cn(
                          'badge text-[11px] font-bold px-2 py-0.5 rounded-full',
                          trx.status === 'pending' && 'bg-amber-100 text-amber-800 border border-amber-300',
                          (trx.status === 'approved' || !trx.status) && 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                          trx.status === 'rejected' && 'bg-rose-100 text-rose-800 border border-rose-300',
                        )}>
                          {trx.status === 'pending' ? 'Menunggu Persetujuan' : trx.status === 'rejected' ? 'Ditolak' : 'Disetujui'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transaksiKeluarList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <FileText className="w-8 h-8 text-dark-200 mx-auto mb-2" />
                        <p className="text-dark-500 text-xs font-semibold">Belum ada transaksi pengeluaran barang</p>
                        <p className="text-dark-400 text-[11px] mt-0.5">Transaksi permintaan barang persediaan akan tampil di sini</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* 2. TAMPILAN KHUSUS PEGAWAI (RELEVAN & TIDAK SEPI) */
        /* ======================================================== */
        <div className="space-y-6">
          {/* Stats Cards Pegawai (4 Kartu Khusus Pegawai) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <StatsCard
                title="Katalog Barang Tersedia"
                value={formatNumber(totalBarang)}
                subtitle="item ATK siap diminta"
                icon={<ShoppingBag className="w-5 h-5 text-white" />}
                variant="blue"
                delay={0}
              />
            </div>
            <div>
              <StatsCard
                title="Pengajuan SPB Saya"
                value={formatNumber(myRequests.length)}
                subtitle="surat permintaan dibuat"
                icon={<FileCheck className="w-5 h-5 text-white" />}
                variant="green"
                delay={100}
              />
            </div>
            <div>
              <StatsCard
                title="Menunggu Persetujuan"
                value={formatNumber(myPendingCount)}
                subtitle="sedang diproses admin gudang"
                icon={<Clock className="w-5 h-5 text-white" />}
                variant="orange"
                trend={myPendingCount > 0 ? { value: myPendingCount, direction: 'up' } : undefined}
                delay={200}
              />
            </div>
            <div>
              <StatsCard
                title="Disetujui & Siap Diambil"
                value={formatNumber(myApprovedCount)}
                subtitle="dapat diambil di gudang"
                icon={<CheckCircle2 className="w-5 h-5 text-white" />}
                variant="green"
                delay={300}
              />
            </div>
          </div>

          {/* Grid Informasi & Pintasan Cepat Pegawai */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Banner Ajukan Permintaan Cepat */}
            <div className="lg:col-span-1 card p-6 bg-gradient-to-br from-bps-blue-50/70 via-white to-amber-50/40 border border-bps-blue-100 flex flex-col justify-between space-y-4">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-bps-blue-100 text-bps-blue flex items-center justify-center mb-3.5 shadow-xs">
                  <ArrowUpFromLine className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-dark-800">
                  Butuh ATK untuk Kegiatan?
                </h3>
                <p className="text-xs text-dark-500 leading-relaxed mt-1">
                  Ajukan Surat Permintaan Barang (SPB) sekarang. Admin gudang akan segera memverifikasi ketersediaan stok fisik di ruang penyimpanan.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/transaksi-keluar"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-bps-blue hover:bg-bps-blue-700 text-white shadow-sm transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Buat Surat Permintaan Baru</span>
                </Link>
              </div>
            </div>

            {/* Panduan Alur Permintaan Barang */}
            <div className="lg:col-span-2 card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-bps-orange" />
                <h3 className="text-sm font-bold text-dark-800 uppercase tracking-wider">
                  Alur Pengajuan & Pengambilan Barang Persediaan
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-dark-50 border border-dark-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-bps-blue text-white font-black text-xs flex items-center justify-center">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-dark-800">Pilih Barang & Buat SPB</h4>
                  <p className="text-[11px] text-dark-500 leading-relaxed">
                    Cek sisa stok di katalog barang lalu buat formulir permintaan sesuai kebutuhan tim kerja.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-dark-50 border border-dark-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-bps-orange text-white font-black text-xs flex items-center justify-center">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-dark-800">Verifikasi Admin Gudang</h4>
                  <p className="text-[11px] text-dark-500 leading-relaxed">
                    Admin memeriksa ketersediaan fisik barang di gudang dan menyetujui permohonan.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-dark-50 border border-dark-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-bps-green text-white font-black text-xs flex items-center justify-center">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-dark-800">Ambil Fisik di Gudang</h4>
                  <p className="text-[11px] text-dark-500 leading-relaxed">
                    Setelah status Disetujui, ambil fisik barang di ruang persediaan dan cetak bukti tanda terima.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Riwayat Permintaan Barang Saya */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between bg-dark-50/40">
              <div>
                <h2 className="text-base font-bold text-dark-800">Riwayat Pengajuan SPB Saya</h2>
                <p className="text-xs text-dark-400 mt-0.5">Status persetujuan permintaan barang oleh admin gudang</p>
              </div>
              <Link
                href="/transaksi-keluar"
                className="text-xs text-bps-blue font-bold hover:text-bps-blue-700 flex items-center gap-1 transition-colors"
              >
                Lihat Semua SPB <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="table-container border-0">
              <table>
                <thead>
                  <tr>
                    <th>No. Dokumen SPB</th>
                    <th>Tanggal Permintaan</th>
                    <th>Item Barang yang Diminta</th>
                    <th>Tim Kerja</th>
                    <th>Status Verifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.slice(0, 5).map((trx) => (
                    <tr key={trx.id}>
                      <td>
                        <span className="font-mono text-xs text-bps-blue font-bold">{trx.no_dokumen}</span>
                      </td>
                      <td className="text-xs text-dark-500">{formatDateShort(trx.tanggal)}</td>
                      <td>
                        <div className="space-y-0.5">
                          {trx.items.map((item, idx) => (
                            <p key={idx} className="text-xs text-dark-700 font-medium">
                              {item.barang?.nama_barang} ({item.jumlah} {item.barang?.satuan?.nama_satuan || 'Buah'})
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm text-dark-700 font-semibold">{trx.nama_tim}</td>
                      <td>
                        <span className={cn(
                          'badge text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                          trx.status === 'pending' && 'bg-amber-100 text-amber-800 border border-amber-300',
                          (trx.status === 'approved' || !trx.status) && 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                          trx.status === 'rejected' && 'bg-rose-100 text-rose-800 border border-rose-300',
                        )}>
                          {trx.status === 'pending' ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Persetujuan</span>
                            </>
                          ) : trx.status === 'rejected' ? (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Ditolak</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Disetujui</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <FileText className="w-8 h-8 text-dark-200 mx-auto mb-2" />
                        <p className="text-dark-600 text-xs font-semibold">Belum Ada Pengajuan Surat Permintaan Barang (SPB)</p>
                        <p className="text-dark-400 text-[11px] mt-0.5">
                          Klik tombol <strong>&quot;Ajukan Permintaan SPB&quot;</strong> di atas untuk meminta perlengkapan ATK tim kerja Anda.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
