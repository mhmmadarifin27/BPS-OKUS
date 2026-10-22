'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList, Search, Printer, Calendar, FileText, ArrowRight,
  Layers, CheckCircle2, ChevronRight, Eye, ArrowDownToLine, ArrowUpFromLine,
  HelpCircle, ShieldCheck, Plus, X, AlertTriangle, Package
} from 'lucide-react';
import { mockKartuKendali, mockBarang, mockTransaksiKeluar, mockTransaksiMasuk } from '@/lib/mock-data';
import { TIM_PEMOHON_LIST, getStoredTimList, formatNamaPJ, TimPemohon } from '@/types';
import type { KartuKendali, Barang, TransaksiKeluar, TransaksiMasuk } from '@/types';
import { cn, formatDateShort, formatNumber } from '@/lib/utils';
import KopSurat from '@/components/KopSurat';
import {
  fetchAndSyncBarang,
  fetchAndSyncTransaksiKeluar,
  fetchAndSyncTransaksiMasuk,
} from '@/lib/sync-service';

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function KartuKendaliPage() {
  const [activeTab, setActiveTab] = useState<'katalog' | 'kartu' | 'daftar'>('katalog');
  const [selectedBarangId, setSelectedBarangId] = useState<number>(1); // Default Stabillo (ID 1)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'kartu' | 'katalog' | 'daftar' | 'batch'>('kartu');
  const [filterKategori, setFilterKategori] = useState<string>('all');
  const [filterMutasiOnly, setFilterMutasiOnly] = useState<boolean>(false);

  // === State Form Input Mutasi Langsung ===
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputJenis, setInputJenis] = useState<'masuk' | 'keluar'>('masuk');
  const [inputTanggal, setInputTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inputNoReferensi, setInputNoReferensi] = useState<string>('');
  const [inputJumlah, setInputJumlah] = useState<number>(1);
  const [inputUraian, setInputUraian] = useState<string>('');
  const [inputHargaSatuan, setInputHargaSatuan] = useState<number>(0);
  const [timList, setTimList] = useState<TimPemohon[]>(() => {
    if (typeof window !== 'undefined') return getStoredTimList();
    return TIM_PEMOHON_LIST;
  });
  const [inputTimPemohon, setInputTimPemohon] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const list = getStoredTimList();
      return list[0]?.id || 'tim-umum';
    }
    return 'tim-umum';
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dynamic Data Lists dari LocalStorage
  const [barangList, setBarangList] = useState<Barang[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sipersedia_barang_list');
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
    }
    return mockBarang;
  });
  const [transaksiKeluarList, setTransaksiKeluarList] = useState<TransaksiKeluar[]>([...mockTransaksiKeluar]);
  const [transaksiMasukList, setTransaksiMasukList] = useState<TransaksiMasuk[]>([...mockTransaksiMasuk]);

  useEffect(() => {
    const bSaved = localStorage.getItem('sipersedia_barang_list');
    if (bSaved !== null) {
      try {
        const parsed = JSON.parse(bSaved);
        if (Array.isArray(parsed)) {
          setBarangList(parsed);
          if (parsed.length > 0) {
            setSelectedBarangId(prev => (parsed.some((b: Barang) => b.id === prev) ? prev : parsed[0].id));
          }
        }
      } catch (e) {}
    }
    const kSaved = localStorage.getItem('sipersedia_transaksi_keluar');
    if (kSaved) {
      try {
        const parsed = JSON.parse(kSaved);
        if (Array.isArray(parsed)) setTransaksiKeluarList(parsed);
      } catch (e) {}
    }
    const mSaved = localStorage.getItem('sipersedia_transaksi_masuk');
    if (mSaved) {
      try {
        const parsed = JSON.parse(mSaved);
        if (Array.isArray(parsed)) setTransaksiMasukList(parsed);
      } catch (e) {}
    }

    // Sinkronisasi data cloud terbaru
    let curBarang = barangList;
    fetchAndSyncBarang().then((bData) => {
      if (bData && bData.length > 0) {
        curBarang = bData;
        setBarangList(bData);
      }
    });
    fetchAndSyncTransaksiKeluar(curBarang).then((kData) => {
      if (kData) setTransaksiKeluarList(kData);
    });
    fetchAndSyncTransaksiMasuk(curBarang).then((mData) => {
      if (mData) setTransaksiMasukList(mData);
    });

    const handleTimUpdate = () => {
      setTimList(getStoredTimList());
    };
    window.addEventListener('timListUpdated', handleTimUpdate);
    window.addEventListener('storage', handleTimUpdate);

    return () => {
      window.removeEventListener('timListUpdated', handleTimUpdate);
      window.removeEventListener('storage', handleTimUpdate);
    };
  }, [refreshKey]);

  // Helper fungsi untuk menghitung kartu kendali lengkap bagi barang tertentu
  const computeSingleCard = (targetBarang: Barang) => {
    // ponytail: Sistem dimulai resmi dari Oktober 2026, saldo awal sebelum pembukuan adalah 0
    const stockAwal = (targetBarang as any)?.stok_awal ?? 0;

    const isMatch = (i: any) => {
      if (!i) return false;
      if (String(i.id_barang) === String(targetBarang.id)) return true;
      if (i.barang?.id && String(i.barang.id) === String(targetBarang.id)) return true;
      if (i.barang?.nama_barang && i.barang.nama_barang.trim().toLowerCase() === targetBarang.nama_barang.trim().toLowerCase()) return true;
      return false;
    };

    const mMasuk = transaksiMasukList
      .filter(t => {
        const year = new Date(t.tanggal).getFullYear();
        return (year === selectedYear || isNaN(year)) &&
          Array.isArray(t.items) &&
          t.items.some(isMatch);
      })
      .map(t => {
        const itm = t.items?.find(isMatch);
        return {
          id: t.id,
          tanggal: t.tanggal,
          no_referensi: t.no_referensi || t.no_dokumen,
          uraian: itm?.keterangan || t.keterangan || `Penerimaan ${t.sumber}`,
          masuk: Number(itm?.jumlah) || 0,
          keluar: 0,
          sisa: 0,
        };
      });

    const mKeluar = transaksiKeluarList
      .filter(t => {
        // Hanya transaksi yang sudah disetujui admin yang memotong kartu kendali
        if (t.status === 'pending' || t.status === 'rejected') return false;
        const year = new Date(t.tanggal).getFullYear();
        return (year === selectedYear || isNaN(year)) &&
          Array.isArray(t.items) &&
          t.items.some(isMatch);
      })
      .map(t => {
        const itm = t.items?.find(isMatch);
        return {
          id: t.id,
          tanggal: t.tanggal,
          no_referensi: t.no_dokumen,
          uraian: itm?.keterangan || t.keterangan || `Permintaan ${t.nama_tim || ''}`,
          masuk: 0,
          keluar: Number(itm?.jumlah) || 0,
          sisa: 0,
        };
      });

    const rawEntries = [...mMasuk, ...mKeluar].sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    // Hitung ulang saldo berjalan secara runtut & matematis: Sisa = prev + Masuk - Keluar
    let running = stockAwal;
    const entries = rawEntries.map(e => {
      running = running + e.masuk - e.keluar;
      return {
        ...e,
        sisa: Math.max(0, running),
      };
    });

    const totalMasuk = entries.reduce((s, e) => s + e.masuk, 0);
    const totalKeluar = entries.reduce((s, e) => s + e.keluar, 0);
    let sisaAkhir = entries.length > 0 ? entries[entries.length - 1].sisa : stockAwal;
    if (targetBarang?.stok !== undefined && targetBarang.stok === 0 && mMasuk.length === 0) {
      sisaAkhir = 0;
    }

    const getMonthlyOut = (m: number) => {
      return entries
        .filter(e => {
          const entryMonth = new Date(e.tanggal).getMonth() + 1;
          return entryMonth === m;
        })
        .reduce((s, e) => s + e.keluar, 0);
    };

    const pengeluaran_bulanan = Array.from({ length: 12 }, (_, i) => getMonthlyOut(i + 1));
    const totalPengeluaranTahunan = pengeluaran_bulanan.reduce((a, b) => a + b, 0);

    const LEFT_CAPACITY = 13;
    const hasRight = entries.length > LEFT_CAPACITY;
    const leftEntries = entries.slice(0, LEFT_CAPACITY);
    const rightEntries = entries.slice(LEFT_CAPACITY);
    const activeRowCount = Math.max(14, hasRight ? 1 + rightEntries.length : 14);

    const leftTotalMasuk = leftEntries.reduce((s, e) => s + e.masuk, 0);
    const leftTotalKeluar = leftEntries.reduce((s, e) => s + e.keluar, 0);
    const leftLastSisa = leftEntries.length > 0 ? leftEntries[leftEntries.length - 1].sisa : stockAwal;

    const rightTotalMasuk = rightEntries.reduce((s, e) => s + e.masuk, 0);
    const rightTotalKeluar = rightEntries.reduce((s, e) => s + e.keluar, 0);

    return {
      barang: targetBarang,
      id: targetBarang.id,
      nama_barang: targetBarang.nama_barang,
      kode_barang: targetBarang.kode_barang,
      satuan: targetBarang.satuan?.nama_satuan || 'Buah',
      tahun: selectedYear,
      halaman: 1,
      proyek_rutin: 'Rutin',
      stock_awal_tahun: stockAwal,
      entries,
      totalMasuk,
      totalKeluar,
      sisaAkhir,
      stock_akhir_tahun: sisaAkhir,
      pengeluaran_bulanan,
      totalPengeluaranTahunan,
      getMonthlyOut,
      LEFT_CAPACITY,
      leftEntries,
      rightEntries,
      activeRowCount,
      leftTotalMasuk,
      leftTotalKeluar,
      leftLastSisa,
      rightTotalMasuk,
      rightTotalKeluar,
    };
  };

  // Daftar kartu kendali untuk seluruh master barang
  const allCardsRaw = (barangList || []).map(b => computeSingleCard(b));
  // Kartu barang aktif (fallback ke seluruh barang jika tidak ada yang stok > 0)
  const activeStockCards = allCardsRaw.filter(c => Number(c.sisaAkhir || 0) > 0);
  const allCardsList = activeStockCards.length > 0 ? activeStockCards : allCardsRaw;

  // Daftar barang yang tersedia untuk dipilih
  const availableBarangList = allCardsList.map(c => c.barang).filter(Boolean);
  const activeBarang = availableBarangList.find(b => b.id === selectedBarangId) || availableBarangList[0] || (barangList[0] || mockBarang[0]);
  const currentCard = allCardsList.find(c => c.id === activeBarang?.id) || allCardsList[0] || (allCardsRaw[0] || null);

  const leftEntries = currentCard?.leftEntries || [];
  const rightEntries = currentCard?.rightEntries || [];
  const stockAwal = currentCard?.stock_awal_tahun || 0;
  const sisaAkhir = currentCard?.stock_akhir_tahun || 0;
  const totalMasuk = currentCard?.totalMasuk || 0;
  const totalKeluar = currentCard?.totalKeluar || 0;
  const totalPengeluaranTahunan = currentCard?.totalPengeluaranTahunan || 0;
  const leftTotalMasuk = currentCard?.leftTotalMasuk || 0;
  const leftTotalKeluar = currentCard?.leftTotalKeluar || 0;
  const leftLastSisa = currentCard?.leftLastSisa || 0;
  const rightTotalMasuk = currentCard?.rightTotalMasuk || 0;
  const rightTotalKeluar = currentCard?.rightTotalKeluar || 0;
  const activeRowCount = currentCard?.activeRowCount || 14;
  const LEFT_CAPACITY = currentCard?.LEFT_CAPACITY || 13;
  const getMonthlyOut = currentCard?.getMonthlyOut || (() => 0);

  const filteredAllCards = allCardsList.filter(c => {
    const matchSearch = c.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.kode_barang && c.kode_barang.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchMutasi = !filterMutasiOnly || c.entries.length > 0;
    const matchKategori = filterKategori === 'all' || c.barang.kategori?.nama_kategori === filterKategori;
    return matchSearch && matchMutasi && matchKategori;
  });

  // Handler cetak dokumen bersih (tanpa tulisan SIPERSEDIA di header browser)
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Komponen Helper untuk merender Tampilan Kartu Persediaan Barang Pakai Habis (ATK/ARK)
  // Digunakan seragam untuk tampilan layar, cetak tunggal, maupun cetak massal (batch)
  const renderCardContent = (c: ReturnType<typeof computeSingleCard>, isPrint: boolean = false) => {
    if (!c) return null;
    return (
      <div className={cn('bg-white text-black', isPrint ? 'card-print-page' : '')}>
        {/* Header Kartu Sesuai Format Resmi PDF Halaman 3 */}
        <div className={cn('text-center border-b border-dark-200', isPrint ? 'mb-1 print:mb-1 pb-1' : 'mb-5 pb-3')}>
          <h2 className={cn('font-extrabold text-black uppercase tracking-wider', isPrint ? 'text-xs print:text-[11.5pt] print:tracking-normal' : 'text-base')}>
            KARTU PERSEDIAAN BARANG PAKAI HABIS (ATK/ARK)
          </h2>
        </div>

        {/* Identitas Barang & Satuan Kerja Sesuai Format Gambar Excel BPS */}
        <div className={cn(
          'grid grid-cols-1 md:grid-cols-12 gap-3 text-black items-start',
          isPrint ? 'grid-cols-12 mb-1.5 print:mb-1 text-xs print:text-[9pt]' : 'mb-4 text-xs'
        )}>
          <div className="col-span-4 md:col-span-4 flex flex-col items-start justify-start pt-0">
            <div className="flex flex-col items-center text-center">
              <img
                src="/images/logo-bps.svg"
                alt="Logo BPS"
                className={cn('w-auto object-contain mb-0.5', isPrint ? 'h-9 print:h-9' : 'h-14')}
              />
              <div
                style={{ fontFamily: 'Arial, sans-serif', fontSize: isPrint ? '7.5pt' : '9pt', lineHeight: 1.15 }}
                className="font-bold italic text-black text-center"
              >
                <p>Badan Pusat Statistik</p>
                <p>Kabupaten Ogan Komering Ulu Selatan</p>
              </div>
            </div>
          </div>

          <div
            className="col-span-5 md:col-span-5 space-y-0.5 font-medium items-start pt-0"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: isPrint ? '10px' : '11px' }}
          >
            <div className="flex items-center">
              <span className="w-24 text-black">Nama Barang</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold text-black uppercase">{c.nama_barang}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 text-black">Kode Barang</span>
              <span className="w-3 text-center">:</span>
              <span className="font-mono font-bold text-black">{c.kode_barang || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 text-black">Satuan Barang</span>
              <span className="w-3 text-center">:</span>
              <span className="text-black">{c.satuan}</span>
            </div>
          </div>

          <div
            className="col-span-3 md:col-span-3 space-y-0.5 font-medium items-start pt-0"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: isPrint ? '10px' : '11px' }}
          >
            <div className="flex items-center">
              <span className="w-20 text-black">Halaman</span>
              <span className="w-3 text-center">:</span>
              <span className="text-black font-semibold">{c.halaman || 1}</span>
            </div>
            <div className="flex items-center">
              <span className="w-20 text-black">Proyek/Rutin</span>
              <span className="w-3 text-center">:</span>
              <span className="text-black">{c.proyek_rutin || 'Rutin'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-20 text-black">Tahun</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold text-black">{c.tahun}</span>
            </div>
          </div>
        </div>

        {/* TABEL 1: Banyaknya Pengeluaran Tiap-Tiap Bulan (15 Kolom Horizontal: 12 Bulan + 3 Ringkasan) */}
        <div className={cn('overflow-x-auto', isPrint ? 'mb-1.5 print:mb-1' : 'mb-6')}>
          <table className={cn(
            'w-full border-collapse border border-black text-center',
            isPrint ? 'text-[8.5px] print:text-[8pt]' : 'text-xs'
          )}>
            <thead>
              <tr className="bg-gray-100 font-bold text-black">
                <th colSpan={12} className="border border-black py-0.5 uppercase tracking-wider text-[8.5px] print:text-[7.5pt]">
                  Banyaknya Pengeluaran Tiap-Tiap Bulan
                </th>
                <th rowSpan={2} className="border border-black px-1 py-0.5 text-[8px] print:text-[7.5pt] leading-tight w-20 print:w-22">
                  Jumlah Pengeluaran
                </th>
                <th rowSpan={2} className="border border-black px-1 py-0.5 text-[8px] print:text-[7.5pt] leading-tight w-20 print:w-22 bg-amber-50/40" title="Saldo Awal Tahun (Per 1 Januari)">
                  Stock Awal tahun
                </th>
                <th rowSpan={2} className="border border-black px-1 py-0.5 text-[8px] print:text-[7.5pt] leading-tight w-20 print:w-22 bg-blue-50/40" title="Saldo Akhir Tahun (Per 31 Desember)">
                  Stock Akhir tahun
                </th>
              </tr>
              <tr className="bg-gray-50 font-semibold text-black text-[8px] print:text-[7pt]">
                {BULAN_NAMES.map((bln, idx) => (
                  <th key={idx} className="border border-black px-0.5 py-0.5">
                    {bln}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={cn('text-black font-semibold', isPrint ? 'h-4 print:h-[22px]' : 'h-7')}>
                {BULAN_NAMES.map((_, idx) => {
                  const out = c.pengeluaran_bulanan[idx];
                  if (idx === 0) {
                    const val = out > 0 ? out : (c.stock_awal_tahun > 0 ? c.stock_awal_tahun : '');
                    return (
                      <td key={idx} className="border border-black py-0.5">
                        {val}
                      </td>
                    );
                  }
                  return (
                    <td key={idx} className="border border-black py-0.5">
                      {out > 0 ? out : ''}
                    </td>
                  );
                })}
                <td className="border border-black py-0.5 font-bold text-black bg-gray-50">
                  {c.totalPengeluaranTahunan > 0 ? c.totalPengeluaranTahunan : ''}
                </td>
                <td className="border border-black py-0.5 font-bold text-black bg-amber-50/20" title={`Saldo Awal 1 Januari: ${c.stock_awal_tahun}`}>
                  {c.stock_awal_tahun}
                </td>
                <td className="border border-black py-0.5 font-extrabold text-blue-900 bg-blue-50/30" title={`Sisa Akhir 31 Desember: ${c.stock_akhir_tahun}`}>
                  {c.stock_akhir_tahun}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TABEL 2: Rincian Mutasi Barang Dual-Pane (14 Kolom) Sesuai Halaman 3 PDF */}
        <div className={cn('overflow-x-auto', isPrint ? 'mb-1 print:mb-0' : 'mb-6')}>
          <table className={cn(
            'w-full border-collapse border border-black',
            isPrint ? 'text-[8.5px] print:text-[8pt]' : 'text-[10px]'
          )}>
            <thead>
              <tr className="bg-gray-100 font-bold text-black text-center">
                {/* Kolom Sisi Kiri */}
                <th className="border border-black px-1 py-0.5 w-7">No.</th>
                <th className="border border-black px-1 py-0.5 w-20">No. Bon/Faktur</th>
                <th className="border border-black px-1 py-0.5 w-16">Tgl M/K</th>
                <th className="border border-black px-1.5 py-0.5 text-left">Uraian Pemasukan/Pengeluaran</th>
                <th className="border border-black px-1 py-0.5 w-12">Masuk (M)</th>
                <th className="border border-black px-1 py-0.5 w-12">Keluar (K)</th>
                <th className="border border-black px-1.5 py-0.5 w-14">Sisa Barang</th>

                {/* Kolom Sisi Kanan */}
                <th className="border border-black px-1 py-0.5 w-7">No.</th>
                <th className="border border-black px-1 py-0.5 w-20">No. Bon/Faktur</th>
                <th className="border border-black px-1 py-0.5 w-16">Tgl M/K</th>
                <th className="border border-black px-1.5 py-0.5 text-left">Uraian Pemasukan/Pengeluaran</th>
                <th className="border border-black px-1 py-0.5 w-12">Masuk (M)</th>
                <th className="border border-black px-1 py-0.5 w-12">Keluar (K)</th>
                <th className="border border-black px-1.5 py-0.5 w-14">Sisa Barang</th>
              </tr>
              <tr className="bg-gray-50 text-[7px] print:text-[6.5pt] text-gray-600 font-bold text-center h-3">
                <th className="border border-black py-0 px-0.5 leading-tight">(1)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(2)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(3)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(4)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(5)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(6)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(7)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(8)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(9)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(10)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(11)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(12)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(13)</th>
                <th className="border border-black py-0 px-0.5 leading-tight">(14)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: c.activeRowCount }).map((_, rIdx) => {
                const isPindahanRow = rIdx === 0;
                const left = rIdx > 0 ? c.leftEntries[rIdx - 1] : null;
                const right = rIdx > 0 ? c.rightEntries[rIdx - 1] : null;

                return (
                  <tr key={rIdx} className={cn('text-black hover:bg-gray-50/50', isPrint ? 'h-[16px] print:h-[23px]' : 'h-[21px]')}>
                    {/* Sisi Kiri */}
                    {isPindahanRow ? (
                      <>
                        <td className="border border-black px-1 py-0 text-center"></td>
                        <td className="border border-black px-1 py-0 font-mono text-[8.5px]"></td>
                        <td className="border border-black px-1 py-0 text-center"></td>
                        <td className="border border-black px-1.5 py-0 font-medium"></td>
                        <td className="border border-black px-1 py-0 text-center"></td>
                        <td className="border border-black px-1 py-0 text-center"></td>
                        <td className="border border-black px-1 py-0 text-center"></td>
                      </>
                    ) : (
                      <>
                        <td className="border border-black px-1 py-0 text-center font-medium">
                          {left ? rIdx : ''}
                        </td>
                        <td className="border border-black px-1 py-0 font-mono text-[8px]">
                          {left?.no_referensi || ''}
                        </td>
                        <td className="border border-black px-1 py-0 text-center">
                          {left ? formatDateShort(left.tanggal) : ''}
                        </td>
                        <td className="border border-black px-1.5 py-0 font-medium">
                          {left?.uraian || ''}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-emerald-800">
                          {left && left.masuk > 0 ? left.masuk : (left ? '-' : '')}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-rose-800">
                          {left && left.keluar > 0 ? left.keluar : (left ? '-' : '')}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold">
                          {left ? left.sisa : ''}
                        </td>
                      </>
                    )}

                    {/* Sisi Kanan */}
                    {isPindahanRow ? (
                      <>
                        <td colSpan={4} className="border border-black px-2 py-0 font-bold italic text-black">
                          Pindahan
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-emerald-800"></td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-rose-800"></td>
                        <td className="border border-black px-1 py-0 text-center font-extrabold text-blue-900 bg-blue-50/30">
                          {c.rightEntries.length > 0 ? c.leftLastSisa : ''}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-black px-1 py-0 text-center font-medium">
                          {right ? c.LEFT_CAPACITY + rIdx : ''}
                        </td>
                        <td className="border border-black px-1 py-0 font-mono text-[8px]">
                          {right?.no_referensi || ''}
                        </td>
                        <td className="border border-black px-1 py-0 text-center">
                          {right ? formatDateShort(right.tanggal) : ''}
                        </td>
                        <td className="border border-black px-1.5 py-0 font-medium">
                          {right?.uraian || ''}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-emerald-800">
                          {right && right.masuk > 0 ? right.masuk : (right ? '-' : '')}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold text-rose-800">
                          {right && right.keluar > 0 ? right.keluar : (right ? '-' : '')}
                        </td>
                        <td className="border border-black px-1 py-0 text-center font-bold">
                          {right ? right.sisa : ''}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const filteredBarang = availableBarangList.filter(b =>
    b.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.kode_barang && b.kode_barang.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDaftarPersediaan = availableBarangList
    .filter(b => Number(b.stok || 0) > 0)
    .map((b, idx) => ({
      nomor: idx + 1,
      kode: b.kode_barang,
      uraian: b.nama_barang,
      saldo_1_januari: 0,
      masuk: b.stok,
      keluar: 0,
      satuan: b.satuan?.nama_satuan || 'Buah',
    }))
    .filter(item =>
      item.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kode.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Navigasi ke Kartu Barang tertentu dari Daftar Persediaan
  const handleSelectFromDaftar = (kode: string, uraian: string) => {
    const matched = barangList.find(b => b.kode_barang === kode || b.nama_barang.toLowerCase() === uraian.toLowerCase());
    if (matched) {
      setSelectedBarangId(matched.id);
    }
    setActiveTab('kartu');
  };

  // ========================================
  // HANDLER BUKA MODAL INPUT MUTASI LANGSUNG
  // ========================================
  const handleOpenInputModal = (jenis: 'masuk' | 'keluar') => {
    setInputJenis(jenis);
    setInputTanggal(new Date().toISOString().split('T')[0]);
    setInputNoReferensi('');
    setInputJumlah(1);
    setInputUraian('');
    setInputHargaSatuan(0);
    setInputTimPemohon('tim-sosial');
    setShowInputModal(true);
  };

  // ========================================
  // HANDLER SIMPAN MUTASI → SEKALIGUS TULIS
  // KE TRANSAKSI MASUK/KELUAR DI LOCALSTORAGE
  // ========================================
  const handleSaveInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputJumlah <= 0) {
      setNotification({ type: 'error', message: 'Jumlah harus lebih dari 0!' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (!activeBarang) return;

    if (inputJenis === 'masuk') {
      // === Buat record Transaksi Masuk baru ===
      const existingMasuk = [...transaksiMasukList];
      const docNo = `BM-${new Date(inputTanggal).getFullYear()}/${String(new Date(inputTanggal).getMonth() + 1).padStart(2, '0')}/${String(existingMasuk.length + 1).padStart(3, '0')}`;
      const newTrx: TransaksiMasuk = {
        id: Date.now(),
        no_dokumen: docNo,
        tanggal: inputTanggal,
        sumber: 'Pembelian',
        no_referensi: inputNoReferensi.trim() || docNo,
        items: [{
          id_barang: activeBarang.id,
          jumlah: Number(inputJumlah),
          harga_satuan: Number(inputHargaSatuan) || null,
          keterangan: inputUraian.trim() || null,
          barang: activeBarang,
        }],
        keterangan: inputUraian.trim() || `Penerimaan ${activeBarang.nama_barang}`,
        created_by: 'admin-001',
        created_at: new Date().toISOString(),
      };
      const updatedMasuk = [newTrx, ...existingMasuk];
      setTransaksiMasukList(updatedMasuk);
      localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify(updatedMasuk));

      // Update stok barang di master
      const nextBarang = barangList.map(b => {
        if (b.id === activeBarang.id) return { ...b, stok: b.stok + Number(inputJumlah) };
        return b;
      });
      setBarangList(nextBarang);
      localStorage.setItem('sipersedia_barang_list', JSON.stringify(nextBarang));

      setNotification({ type: 'success', message: `✅ Barang masuk +${inputJumlah} ${activeBarang.satuan?.nama_satuan || 'Buah'} "${activeBarang.nama_barang}" berhasil dicatat! Otomatis sinkron ke Transaksi Masuk & Laporan.` });
    } else {
      // === Buat record Transaksi Keluar baru ===
      const existingKeluar = [...transaksiKeluarList];
      const timObj = timList.find(t => t.id === inputTimPemohon) || timList[0] || TIM_PEMOHON_LIST[1];
      const docNo = `BK-${new Date(inputTanggal).getFullYear()}/${String(new Date(inputTanggal).getMonth() + 1).padStart(2, '0')}/${String(existingKeluar.length + 1).padStart(3, '0')}`;
      const newTrx: TransaksiKeluar = {
        id: Date.now(),
        no_dokumen: docNo,
        tanggal: inputTanggal,
        tim_pemohon: timObj.id,
        nama_tim: timObj.nama_tim,
        penanggung_jawab: formatNamaPJ(timObj.penanggung_jawab),
        nip_pj: timObj.nip_pj,
        items: [{
          id_barang: activeBarang.id,
          jumlah: Number(inputJumlah),
          keterangan: inputUraian.trim() || null,
          barang: activeBarang,
        }],
        keterangan: inputUraian.trim() || `Permintaan ${timObj.nama_tim}`,
        created_by: 'admin-001',
        created_at: new Date().toISOString(),
      };
      const updatedKeluar = [newTrx, ...existingKeluar];
      setTransaksiKeluarList(updatedKeluar);
      localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify(updatedKeluar));

      // Update stok barang di master
      const nextBarang = barangList.map(b => {
        if (b.id === activeBarang.id) return { ...b, stok: Math.max(0, b.stok - Number(inputJumlah)) };
        return b;
      });
      setBarangList(nextBarang);
      localStorage.setItem('sipersedia_barang_list', JSON.stringify(nextBarang));

      setNotification({ type: 'success', message: `✅ Barang keluar -${inputJumlah} ${activeBarang.satuan?.nama_satuan || 'Buah'} "${activeBarang.nama_barang}" berhasil dicatat! Otomatis sinkron ke Transaksi Keluar & Laporan.` });
    }

    setShowInputModal(false);
    setRefreshKey(prev => prev + 1);
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="page-enter space-y-6">
      {/* NOTIFIKASI TOAST */}
      {notification && (
        <div className={cn(
          'fixed top-6 right-6 z-[60] max-w-md px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold animate-slide-in-up',
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' :
          'bg-blue-50 border-blue-300 text-blue-800'
        )}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Konten Dashboard (Disembunyikan saat mencetak dokumen) */}
      <div className="print:hidden space-y-6">
        {/* Header Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark-800">Kartu Kendali Persediaan</h1>
            <span className="text-xs bg-bps-blue-50 text-bps-blue font-bold px-2.5 py-0.5 rounded-full border border-bps-blue-200">
              Dokumen Resmi BPS OKU Selatan
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-1">
            Buku besar pembantu mutasi persediaan barang — Otomatis terhubung dengan Transaksi Masuk, Transaksi Keluar (SPB), dan Laporan Persediaan
          </p>
        </div>

        {/* Tab & Aksi Cetak */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-dark-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('katalog')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'katalog' ? 'bg-white text-bps-blue shadow-xs' : 'text-dark-500 hover:text-dark-800'
              )}
            >
              <Package className="w-3.5 h-3.5" />
              Ikhtisar Semua Barang ({allCardsList.length})
            </button>
            <button
              onClick={() => setActiveTab('kartu')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'kartu' ? 'bg-white text-bps-blue shadow-xs' : 'text-dark-500 hover:text-dark-800'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Detail Kartu Barang
            </button>
            <button
              onClick={() => setActiveTab('daftar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'daftar' ? 'bg-white text-bps-blue shadow-xs' : 'text-dark-500 hover:text-dark-800'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Daftar 1 Jan (BPS)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'kartu' && (
              <button
                onClick={() => setShowInputModal(true)}
                className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 font-bold"
                title="Catat mutasi masuk atau keluar baru untuk barang ini"
              >
                <Plus className="w-3.5 h-3.5 text-bps-blue" />
                <span>+ Catat Mutasi</span>
              </button>
            )}

            <button
              onClick={() => {
                if (activeTab === 'katalog') {
                  setPreviewMode('batch');
                } else {
                  setPreviewMode(activeTab);
                }
                setShowPrintPreview(true);
              }}
              className="btn-primary text-xs"
            >
              <Printer className="w-4 h-4" />
              {activeTab === 'katalog'
                ? 'Cetak Semua Kartu (Batch)'
                : activeTab === 'kartu'
                ? 'Cetak Kartu Ini'
                : 'Cetak Daftar Persediaan'}
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & PERIODE */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-dark-50 border border-dark-200 rounded-lg p-1">
            <Calendar className="w-4 h-4 text-dark-400 ml-2" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold text-dark-700 bg-transparent py-1 pr-3 focus:outline-none cursor-pointer"
            >
              <option value={2025}>Tahun Anggaran 2025 (PDF 1)</option>
              <option value={2026}>Tahun Anggaran 2026 (PDF 2)</option>
            </select>
          </div>

          {activeTab === 'katalog' && (
            <label className="flex items-center gap-1.5 text-xs text-dark-700 cursor-pointer select-none bg-dark-50 border border-dark-200 rounded-lg px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={filterMutasiOnly}
                onChange={(e) => setFilterMutasiOnly(e.target.checked)}
                className="rounded border-dark-300 text-bps-blue focus:ring-bps-blue"
              />
              <span className="font-medium">Hanya yang Ada Mutasi ({allCardsList.filter(c => c.entries.length > 0).length})</span>
            </label>
          )}

          <div className="text-xs text-dark-500 hidden md:block">
            {activeTab === 'kartu' ? (
              <span>Barang aktif: <strong>{currentCard?.nama_barang}</strong> ({currentCard?.kode_barang})</span>
            ) : activeTab === 'katalog' ? (
              <span>Menampilkan <strong>{filteredAllCards.length} dari {allCardsList.length} kartu kendali</strong></span>
            ) : (
              <span>Menampilkan <strong>{filteredDaftarPersediaan.length} item</strong> persediaan barang</span>
            )}
          </div>
        </div>

        {/* Input Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-1.5 text-xs w-full"
            placeholder="Cari kode atau nama barang..."
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAMPILAN 0: IKHTISAR & KATALOG SEMUA KARTU KENDALI       */}
      {/* Memudahkan Pengelola Memantau Seluruh Barang             */}
      {/* ======================================================== */}
      {activeTab === 'katalog' && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bps-blue-50 flex items-center justify-center">
                <Package className="w-5 h-5 text-bps-blue" />
              </div>
              <div>
                <p className="text-xl font-bold text-dark-800">{barangList.length}</p>
                <p className="text-xs text-dark-400">Total Jenis Barang</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">
                  {allCardsList.filter(c => c.entries.length > 0).length}
                </p>
                <p className="text-xs text-dark-400">Barang Ada Mutasi</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bps-green-50 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-bps-green" />
              </div>
              <div>
                <p className="text-xl font-bold text-bps-green">
                  {allCardsList.reduce((s, c) => s + c.totalMasuk, 0)}
                </p>
                <p className="text-xs text-dark-400">Total Masuk ({selectedYear})</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bps-orange-50 flex items-center justify-center">
                <ArrowUpFromLine className="w-5 h-5 text-bps-orange" />
              </div>
              <div>
                <p className="text-xl font-bold text-bps-orange">
                  {allCardsList.reduce((s, c) => s + c.totalKeluar, 0)}
                </p>
                <p className="text-xs text-dark-400">Total Keluar ({selectedYear})</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-dark-800">
                  Ikhtisar Seluruh Kartu Kendali Persediaan ({filteredAllCards.length} Barang)
                </h2>
                <p className="text-xs text-dark-400 mt-0.5">
                  Pantau stok awal 1 Januari, penerimaan, pengeluaran, dan sisa per 31 Desember tanpa perlu klik satu per satu
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPreviewMode('batch');
                    setShowPrintPreview(true);
                  }}
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  title="Cetak kartu kendali seluruh barang sekaligus"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Semua Kartu Kendali (Batch)</span>
                </button>
              </div>
            </div>

            <div className="table-container border-0 max-h-[640px] overflow-y-auto">
              <table>
                <thead className="sticky top-0 bg-dark-50 z-10 shadow-xs text-xs">
                  <tr>
                    <th className="w-12 text-center">No</th>
                    <th className="w-24 text-center font-mono">Kode</th>
                    <th>Uraian Nama Barang</th>
                    <th className="text-center w-24">Satuan</th>
                    <th className="text-center w-28">Stok Awal (1 Jan)</th>
                    <th className="text-center w-24 text-emerald-800 bg-emerald-50/50">Masuk ({selectedYear})</th>
                    <th className="text-center w-24 text-rose-800 bg-rose-50/50">Keluar ({selectedYear})</th>
                    <th className="text-center w-28 font-bold bg-blue-50/50">Sisa Akhir (31 Des)</th>
                    <th className="text-center w-28">Status Mutasi</th>
                    <th className="text-center w-36">Aksi Kartu</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllCards.map((c, idx) => {
                    const hasMutasi = c.entries.length > 0;
                    return (
                      <tr key={c.barang.id} className="hover:bg-dark-50/50 text-xs">
                        <td className="text-center text-dark-400 font-medium">{idx + 1}</td>
                        <td className="text-center font-mono font-bold text-bps-blue text-[11px]">{c.kode_barang}</td>
                        <td className="font-semibold text-dark-800">{c.nama_barang}</td>
                        <td className="text-center text-dark-500 font-medium">{c.satuan}</td>
                        <td className="text-center font-bold text-dark-700">{formatNumber(c.stock_awal_tahun)}</td>
                        <td className="text-center font-bold text-emerald-700 bg-emerald-50/30">
                          {c.totalMasuk > 0 ? formatNumber(c.totalMasuk) : '-'}
                        </td>
                        <td className="text-center font-bold text-rose-700 bg-rose-50/30">
                          {c.totalKeluar > 0 ? formatNumber(c.totalKeluar) : '-'}
                        </td>
                        <td className="text-center font-extrabold text-blue-900 bg-blue-50/20">
                          {formatNumber(c.sisaAkhir)}
                        </td>
                        <td className="text-center">
                          {hasMutasi ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {c.entries.length} Mutasi
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                              Stok Tetap
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedBarangId(c.barang.id);
                                setActiveTab('kartu');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-bps-blue hover:bg-bps-blue-700 transition-colors shadow-2xs"
                              title="Buka Kartu Kendali Lengkap"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Lihat Kartu</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBarangId(c.barang.id);
                                setPreviewMode('kartu');
                                setShowPrintPreview(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-dark-700 bg-dark-100 hover:bg-dark-200 transition-colors"
                              title="Cetak Kartu Barang Ini"
                            >
                              <Printer className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAllCards.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-dark-400">
                        Tidak ada barang yang cocok dengan filter / pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAMPILAN 1: KARTU PERSEDIAAN BARANG PAKAI HABIS (ATK/ARK) */}
      {/* PERSIS FORMAT HALAMAN 3 PDF                              */}
      {/* ======================================================== */}
      {activeTab === 'kartu' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Pilih Barang */}
          <div className="lg:col-span-1">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-100">
                <h3 className="text-xs font-bold text-dark-700 uppercase tracking-wider">Pilih Barang</h3>
                <span className="text-[10px] bg-dark-100 text-dark-600 px-2 py-0.5 rounded-full font-semibold">
                  {filteredBarang.length} barang
                </span>
              </div>

              {/* Daftar Tombol Barang — Scroll Vertikal Rapi */}
              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {filteredBarang.length === 0 && (
                  <div className="text-center py-8 text-dark-400 text-xs px-2">
                    <Package className="w-8 h-8 text-dark-200 mx-auto mb-2" />
                    <p className="font-semibold text-dark-700">Belum ada barang persediaan</p>
                    <p className="text-[11px] mt-1 mb-3 text-dark-400">Tambahkan barang terlebih dahulu untuk mengaktifkan kartu kendali.</p>
                    <Link href="/barang" className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Tambah Barang
                    </Link>
                  </div>
                )}
                {filteredBarang.map(b => {
                  const isSelected = selectedBarangId === b.id;
                  const hasCard = mockKartuKendali.some(k => k.id_barang === b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarangId(b.id)}
                      className={cn(
                        'w-full text-left p-2.5 rounded-lg transition-all duration-150 text-xs border',
                        isSelected
                          ? 'bg-bps-blue text-white shadow-sm font-semibold border-bps-blue-600'
                          : 'hover:bg-dark-50 text-dark-700 border-dark-100/70 bg-white'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{b.nama_barang}</span>
                        <span className={cn(
                          'font-mono text-[10px] px-1 rounded',
                          isSelected ? 'bg-bps-blue-700 text-white' : 'text-dark-500 bg-dark-100'
                        )}>
                          {b.kode_barang || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className={isSelected ? 'text-bps-blue-100' : 'text-dark-400'}>
                          Satuan: {b.satuan?.nama_satuan || 'Buah'}
                        </span>
                        {hasCard && (
                          <span className={cn(
                            'px-1.5 py-0.2 rounded font-medium text-[9px]',
                            isSelected ? 'bg-bps-blue-600 text-white' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          )}>
                            Ada Mutasi
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Konten Kartu Kendali Sesuai Halaman 3 PDF */}
          <div className="lg:col-span-3">
            {currentCard ? (
              <div className="card p-6 bg-white overflow-x-auto shadow-sm border border-dark-200">
                {renderCardContent(currentCard, false)}
              </div>
            ) : (
              <div className="card p-12 text-center">
                <ClipboardList className="w-16 h-16 text-dark-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-dark-500">Pilih Barang</h3>
                <p className="text-sm text-dark-400 mt-1">Pilih barang dari daftar di sebelah kiri untuk melihat kartu kendali</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAMPILAN 2: DAFTAR REKAPITULASI PERSEDIAAN BARANG         */}
      {/* PERSIS FORMAT HALAMAN 1 & 2 PDF                          */}
      {/* ======================================================== */}
      {activeTab === 'daftar' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-dark-800">
                Daftar Persediaan Barang — Saldo Awal, Masuk, dan Keluar
              </h2>
              <p className="text-xs text-dark-400 mt-0.5">
                Format resmi sesuai Dokumen PDF Halaman 1 &amp; 2 (Tahun {selectedYear})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-500 font-medium">
                Klik ikon <Eye className="w-3.5 h-3.5 inline text-bps-blue" /> untuk buka Kartu Kendali per barang
              </span>
            </div>
          </div>

          <div className="table-container border-0 max-h-[620px] overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-dark-50 z-10 shadow-xs text-xs">
                <tr>
                  <th className="w-14 text-center">Nomor</th>
                  <th className="w-24 text-center font-mono">KODE</th>
                  <th>U R A I A N</th>
                  <th className="text-center w-36">JUMLAH Saldo 1 Januari</th>
                  <th className="text-center w-24 text-emerald-800 bg-emerald-50/50">MASUK</th>
                  <th className="text-center w-24 text-rose-800 bg-rose-50/50">KELUAR</th>
                  <th className="text-center w-24">Satuan</th>
                  <th className="text-center w-28 font-bold bg-blue-50/50">Sisa Akhir</th>
                  <th className="text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDaftarPersediaan.map((item) => {
                  const sisa = (item.saldo_1_januari || 0) + (item.masuk || 0) - (item.keluar || 0);
                  return (
                    <tr key={item.nomor} className="hover:bg-dark-50/50 text-xs">
                      <td className="text-center text-dark-400 font-medium">{item.nomor}</td>
                      <td className="text-center font-mono font-bold text-bps-blue text-[11px]">{item.kode}</td>
                      <td className="font-semibold text-dark-800">{item.uraian}</td>
                      <td className="text-center font-bold text-dark-700">{formatNumber(item.saldo_1_januari)}</td>
                      <td className="text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {item.masuk > 0 ? formatNumber(item.masuk) : '-'}
                      </td>
                      <td className="text-center font-bold text-rose-700 bg-rose-50/30">
                        {item.keluar > 0 ? formatNumber(item.keluar) : '0'}
                      </td>
                      <td className="text-center text-dark-500 font-medium">{item.satuan}</td>
                      <td className="text-center font-extrabold text-blue-900 bg-blue-50/20">
                        {formatNumber(sisa)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleSelectFromDaftar(item.kode, item.uraian)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-bps-blue hover:bg-bps-blue-50 transition-colors"
                          title="Buka Kartu Kendali Barang Ini"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Kartu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* ======================================================== */}
      {/* MODAL PRINT PREVIEW RESMI (KOP SURAT TAHOMA 14 & ARIAL 8) */}
      {/* ======================================================== */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-4 border-b border-dark-100 no-print sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-bps-blue" />
                <h2 className="text-base font-bold text-dark-800">
                  {previewMode === 'batch'
                    ? `Preview Cetak: Semua Kartu Persediaan Barang (${filteredAllCards.length} Barang)`
                    : previewMode === 'kartu'
                    ? `Preview Cetak: Kartu Persediaan Barang — ${currentCard?.nama_barang} (${currentCard?.tahun})`
                    : `Preview Cetak: Daftar Rekapitulasi Persediaan Barang (Tahun ${selectedYear})`}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5">
                  <Printer className="w-4 h-4" /> Cetak Dokumen
                </button>
                <button onClick={() => setShowPrintPreview(false)} className="btn-secondary text-xs py-2 px-3">
                  Tutup
                </button>
              </div>
            </div>

            {/* Injeksi Style Cetak: Kunci A4 Landscape untuk Kartu Kendali & Cegah Terpotong — Bersih Tanpa Header/Footer Browser (1/1) */}
            <style dangerouslySetInnerHTML={{ __html: `
              @page {
                size: ${(previewMode === 'kartu' || previewMode === 'batch') ? 'A4 landscape' : 'A4 portrait'};
                margin: 0;
              }
              @media print {
                @page {
                  size: ${(previewMode === 'kartu' || previewMode === 'batch') ? 'A4 landscape' : 'A4 portrait'};
                  margin: 0;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .card-print-page {
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  width: 100% !important;
                  height: 206mm !important;
                  min-height: 206mm !important;
                  max-height: 206mm !important;
                  padding: 5mm 8mm 5mm 8mm !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                  overflow: hidden !important;
                }
                .card-print-page:last-child {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
                #print-area {
                  padding: ${(previewMode === 'kartu' || previewMode === 'batch') ? '0' : '8mm 10mm 8mm 10mm'} !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                }
                table {
                  page-break-inside: auto !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .avoid-break {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `}} />

            <div className="p-6 print:p-0 text-black bg-white" id="print-area">
              {/* Kop Surat hanya muncul untuk Daftar Rekapitulasi Persediaan, TIDAK untuk Kartu Kendali */}
              {previewMode === 'daftar' && <KopSurat />}

              {/* JIKA PREVIEW KARTU PERSEDIAAN TUNGGAL */}
              {previewMode === 'kartu' && currentCard && renderCardContent(currentCard, true)}

              {/* JIKA PREVIEW CETAK SEMUA KARTU KENDALI (BATCH) */}
              {previewMode === 'batch' && (
                <div className="space-y-8 print:space-y-0">
                  {filteredAllCards.map((c) => (
                    <div key={c.barang.id}>
                      {renderCardContent(c, true)}
                    </div>
                  ))}
                </div>
              )}

              {/* JIKA PREVIEW DAFTAR PERSEDIAAN (PERSIS HALAMAN 1 & 2 PDF) */}
              {previewMode === 'daftar' && (
                <>
                  <div className="text-center mb-5">
                    <h3 className="font-extrabold text-black text-sm uppercase tracking-wide">
                      DAFTAR PERSEDIAAN BARANG PER 1 JANUARI {selectedYear}
                    </h3>
                    <p className="text-xs text-gray-700 mt-1">
                      Badan Pusat Statistik Kabupaten Ogan Komering Ulu Selatan
                    </p>
                  </div>

                  <table className="w-full border-collapse border border-black text-[9px] mb-8">
                    <thead>
                      <tr className="bg-gray-100 font-bold text-black text-center">
                        <th className="border border-black px-1 py-1 w-10">Nomor</th>
                        <th className="border border-black px-1.5 py-1 w-16">KODE</th>
                        <th className="border border-black px-2 py-1 text-left">U R A I A N</th>
                        <th className="border border-black px-2 py-1 text-center w-28">JUMLAH Saldo 1 Januari</th>
                        <th className="border border-black px-1.5 py-1 text-center w-16">MASUK</th>
                        <th className="border border-black px-1.5 py-1 text-center w-16">KELUAR</th>
                        <th className="border border-black px-1.5 py-1 text-center w-16">Satuan</th>
                        <th className="border border-black px-2 py-1 text-center w-20">Sisa Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDaftarPersediaan
                        .map((item, idx) => {
                          const sisa = item.saldo_1_januari + item.masuk - item.keluar;
                          return (
                            <tr key={item.nomor} className="text-black">
                              <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                              <td className="border border-black px-1.5 py-0.5 text-center font-mono">{item.kode}</td>
                              <td className="border border-black px-2 py-0.5">{item.uraian}</td>
                              <td className="border border-black px-2 py-0.5 text-center font-semibold">
                                {item.saldo_1_januari > 0 ? formatNumber(item.saldo_1_januari) : '-'}
                              </td>
                              <td className="border border-black px-1.5 py-0.5 text-center">
                                {item.masuk > 0 ? formatNumber(item.masuk) : '-'}
                              </td>
                              <td className="border border-black px-1.5 py-0.5 text-center font-semibold">
                                {item.keluar > 0 ? formatNumber(item.keluar) : '-'}
                              </td>
                              <td className="border border-black px-1.5 py-0.5 text-center">{item.satuan}</td>
                              <td className="border border-black px-2 py-0.5 text-center font-bold">
                                {formatNumber(sisa)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL INPUT MUTASI LANGSUNG (MASUK / KELUAR)              */}
      {/* Data otomatis ditulis ke transaksi_masuk / transaksi_keluar */}
      {/* ======================================================== */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-in-up overflow-hidden">
            {/* Header Modal */}
            <div className={cn(
              'px-6 py-4 flex items-center justify-between',
              inputJenis === 'masuk'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white'
                : 'bg-gradient-to-r from-bps-blue to-blue-500 text-white'
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  {inputJenis === 'masuk'
                    ? <ArrowDownToLine className="w-5 h-5" />
                    : <ArrowUpFromLine className="w-5 h-5" />
                  }
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    {inputJenis === 'masuk' ? 'Input Barang Masuk' : 'Input Barang Keluar'}
                  </h2>
                  <p className="text-xs opacity-80">
                    Barang: <strong>{activeBarang?.nama_barang}</strong> ({activeBarang?.kode_barang})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInputModal(false)}
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveInput} className="p-6 space-y-4">
              {/* Toggle Jenis */}
              <div>
                <label className="block text-xs font-bold text-dark-700 mb-1.5">Jenis Mutasi</label>
                <div className="flex items-center bg-dark-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInputJenis('masuk')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                      inputJenis === 'masuk' ? 'bg-emerald-600 text-white shadow-sm' : 'text-dark-500 hover:text-dark-800'
                    )}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Barang Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputJenis('keluar')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                      inputJenis === 'keluar' ? 'bg-bps-blue text-white shadow-sm' : 'text-dark-500 hover:text-dark-800'
                    )}
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    Barang Keluar
                  </button>
                </div>
              </div>

              {/* Tanggal & No Referensi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dark-700 mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={inputTanggal}
                    onChange={e => setInputTanggal(e.target.value)}
                    className="input py-2 text-xs w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dark-700 mb-1.5">
                    {inputJenis === 'masuk' ? 'No. Bon/Faktur' : 'No. SPB'}
                  </label>
                  <input
                    type="text"
                    value={inputNoReferensi}
                    onChange={e => setInputNoReferensi(e.target.value)}
                    className="input py-2 text-xs w-full"
                    placeholder={inputJenis === 'masuk' ? 'BAST/001/X/2026' : 'SPB/001/X/2026'}
                  />
                </div>
              </div>

              {/* Jumlah */}
              <div>
                <label className="block text-xs font-bold text-dark-700 mb-1.5">
                  Jumlah ({activeBarang?.satuan?.nama_satuan || 'Buah'})
                </label>
                <input
                  type="number"
                  min="1"
                  value={inputJumlah}
                  onChange={e => setInputJumlah(Number(e.target.value))}
                  className="input py-2 text-xs w-full font-bold text-lg"
                  required
                />
              </div>

              {/* Harga Satuan (hanya untuk masuk) */}
              {inputJenis === 'masuk' && (
                <div>
                  <label className="block text-xs font-bold text-dark-700 mb-1.5">Harga Satuan (Rp) — Opsional</label>
                  <input
                    type="number"
                    min="0"
                    value={inputHargaSatuan}
                    onChange={e => setInputHargaSatuan(Number(e.target.value))}
                    className="input py-2 text-xs w-full"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Tim Pemohon (hanya untuk keluar) */}
              {inputJenis === 'keluar' && (
                <div>
                  <label className="block text-xs font-bold text-dark-700 mb-1.5">Tim Pemohon & Penanggung Jawab</label>
                  <select
                    value={inputTimPemohon}
                    onChange={e => setInputTimPemohon(e.target.value)}
                    className="input py-2 text-xs w-full font-medium"
                  >
                    {timList.map(tim => (
                      <option key={tim.id} value={tim.id}>{tim.nama_tim} — PJ: {formatNamaPJ(tim.penanggung_jawab)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Uraian / Keterangan */}
              <div>
                <label className="block text-xs font-bold text-dark-700 mb-1.5">Uraian / Keterangan</label>
                <textarea
                  value={inputUraian}
                  onChange={e => setInputUraian(e.target.value)}
                  className="input py-2 text-xs w-full h-16 resize-none"
                  placeholder={inputJenis === 'masuk' ? 'Contoh: Penerimaan pembelian Q4' : 'Contoh: Keperluan operasional tim'}
                />
              </div>

              {/* Preview Efek */}
              <div className={cn(
                'rounded-xl p-3 text-xs border',
                inputJenis === 'masuk'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              )}>
                <strong>Preview:</strong> Sisa saat ini = <strong>{formatNumber(sisaAkhir)}</strong>
                {inputJenis === 'masuk'
                  ? <> + {inputJumlah} = <strong className="text-emerald-700">{formatNumber(sisaAkhir + inputJumlah)}</strong></>
                  : <> − {inputJumlah} = <strong className="text-amber-700">{formatNumber(Math.max(0, sisaAkhir - inputJumlah))}</strong></>
                }
                {' '}{activeBarang?.satuan?.nama_satuan || 'Buah'}
              </div>

              {/* Peringatan jika keluar melebihi stok */}
              {inputJenis === 'keluar' && inputJumlah > sisaAkhir && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Jumlah keluar (<strong>{inputJumlah}</strong>) melebihi sisa barang (<strong>{sisaAkhir}</strong>). Stok akan menjadi 0.</span>
                </div>
              )}

              {/* Tombol Simpan */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all duration-200',
                    inputJenis === 'masuk'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-bps-blue hover:bg-bps-blue-700'
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {inputJenis === 'masuk' ? 'Simpan & Catat Masuk' : 'Simpan & Catat Keluar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInputModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-dark-600 bg-dark-100 hover:bg-dark-200 transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
