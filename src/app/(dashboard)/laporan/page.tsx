'use client';

import { useState, useEffect } from 'react';
import {
  FileBarChart, Printer, Edit2, Check,
  Package, ArrowDownToLine, ArrowUpFromLine, Wallet, X, Layers, Users, ShieldCheck,
} from 'lucide-react';
import { type RekapitulasiAgustusItem } from '@/lib/data-rekapitulasi-agustus';
import { mockBarang, mockTransaksiMasuk, mockTransaksiKeluar } from '@/lib/mock-data';
import type { Barang, TransaksiMasuk, TransaksiKeluar } from '@/types';
import { cn, formatNumber, getMonthName, getTeksBeritaAcaraOpname, formatTanggalTandaTangan, getAvailableYears, getStoredCustomYears, saveCustomYear } from '@/lib/utils';
import KopSurat from '@/components/KopSurat';
import {
  fetchAndSyncBarang,
  fetchAndSyncTransaksiKeluar,
  fetchAndSyncTransaksiMasuk,
} from '@/lib/sync-service';

export default function LaporanPage() {
  // Default difokuskan ke Bulan Berjalan (Oktober 2026)
  const [bulan, setBulan] = useState(10);
  const [tahun, setTahun] = useState(2026);
  const [activeTab, setActiveTab] = useState<'opname' | 'tim'>('opname');
  const [showPreview, setShowPreview] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [customYears, setCustomYears] = useState<number[]>(() => {
    if (typeof window !== 'undefined') return getStoredCustomYears();
    return [];
  });
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [inputCustomYear, setInputCustomYear] = useState<string>('');
  const [customYearError, setCustomYearError] = useState<string>('');

  // Tanggal Cetak Dinamis - default hari ini, bisa disesuaikan
  const [tglCetakDokumen, setTglCetakDokumen] = useState(() => new Date().toISOString().split('T')[0]);

  // Helper untuk menentukan teks kolom Saldo Awal secara dinamis (misal: Saldo 30 September 2026)
  const getSaldoAwalHeader = (b: number, t: number) => {
    const lastDayPrev = new Date(t, b - 1, 0);
    const day = lastDayPrev.getDate();
    const mName = getMonthName(lastDayPrev.getMonth() + 1);
    const yr = lastDayPrev.getFullYear();
    return `Saldo ${day} ${mName} ${yr}`;
  };

  // Dynamic Data Lists dari LocalStorage
  const [barangList, setBarangList] = useState<Barang[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sipersedia_barang_list');
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        } catch { }
      }
    }
    return mockBarang;
  });
  const [transaksiMasukList, setTransaksiMasukList] = useState<TransaksiMasuk[]>([...mockTransaksiMasuk]);
  const [transaksiKeluarList, setTransaksiKeluarList] = useState<TransaksiKeluar[]>([...mockTransaksiKeluar]);

  useEffect(() => {
    const bSaved = localStorage.getItem('sipersedia_barang_list');
    if (bSaved !== null) {
      try {
        const p = JSON.parse(bSaved);
        if (Array.isArray(p)) setBarangList(p);
      } catch (e) { }
    }
    const mSaved = localStorage.getItem('sipersedia_transaksi_masuk');
    if (mSaved) {
      try {
        const p = JSON.parse(mSaved);
        if (Array.isArray(p)) setTransaksiMasukList(p);
      } catch (e) { }
    }
    const kSaved = localStorage.getItem('sipersedia_transaksi_keluar');
    if (kSaved) {
      try {
        const p = JSON.parse(kSaved);
        if (Array.isArray(p)) setTransaksiKeluarList(p);
      } catch (e) { }
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

    const handleCustomYears = () => {
      setCustomYears(getStoredCustomYears());
    };
    window.addEventListener('customYearsUpdated', handleCustomYears);
    window.addEventListener('storage', handleCustomYears);

    return () => {
      window.removeEventListener('customYearsUpdated', handleCustomYears);
      window.removeEventListener('storage', handleCustomYears);
    };
  }, []);

  // Hitung Data Rekapitulasi secara real-time dari mutasi transaksi aktif
  const getComputedReportData = (targetBulan: number, targetTahun: number): RekapitulasiAgustusItem[] => {
    const parseYearMonth = (tgl: string): { y: number; m: number } | null => {
      if (!tgl) return null;
      const clean = tgl.split('T')[0];
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const itemY = parseInt(parts[0], 10);
        const itemM = parseInt(parts[1], 10);
        if (!isNaN(itemY) && !isNaN(itemM)) return { y: itemY, m: itemM };
      }
      const d = new Date(tgl);
      if (!isNaN(d.getTime())) return { y: d.getFullYear(), m: d.getMonth() + 1 };
      return null;
    };

    const matchesMonthYear = (tgl: string, m: number, y: number) => {
      const ym = parseYearMonth(tgl);
      return ym ? ym.m === m && ym.y === y : false;
    };

    const isBeforeMonthYear = (tgl: string, m: number, y: number) => {
      const ym = parseYearMonth(tgl);
      if (!ym) return false;
      if (ym.y < y) return true;
      if (ym.y === y && ym.m < m) return true;
      return false;
    };

    const itemsToProcess = barangList.length > 0 ? barangList : mockBarang;

    return itemsToProcess.map((b, i) => {
      // Mutasi untuk bulan tertentu
      const getMonthMutasi = (m: number, y: number) => {
        let beli = 0;
        let transfer = 0;
        let keluar = 0;
        let rusak = 0;
        let usang = 0;
        const tim = { umum: 0, sosial: 0, ipds: 0, pertanian: 0, distribusi: 0, neraca: 0, pek: 0 };

        // Transaksi masuk dari database / form
        transaksiMasukList.forEach(t => {
          if (matchesMonthYear(t.tanggal, m, y)) {
            t.items?.forEach(itm => {
              const isMatch =
                String(itm.id_barang) === String(b.id) ||
                (itm.barang?.id && String(itm.barang.id) === String(b.id)) ||
                (itm.barang?.nama_barang && itm.barang.nama_barang.trim().toLowerCase() === b.nama_barang.trim().toLowerCase());
              if (isMatch) {
                const qty = Number(itm.jumlah) || 0;
                if (t.sumber === 'Pembelian') beli += qty;
                else transfer += qty; // 'Dari Provinsi' atau 'Transfer Masuk'
              }
            });
          }
        });

        // Transaksi keluar dari database / form (hanya yang sudah disetujui / status bukan pending/rejected)
        transaksiKeluarList.forEach(t => {
          if (t.status === 'pending' || t.status === 'rejected') return;
          if (matchesMonthYear(t.tanggal, m, y)) {
            t.items?.forEach(itm => {
              const isMatch =
                String(itm.id_barang) === String(b.id) ||
                (itm.barang?.id && String(itm.barang.id) === String(b.id)) ||
                (itm.barang?.nama_barang && itm.barang.nama_barang.trim().toLowerCase() === b.nama_barang.trim().toLowerCase());
              if (isMatch) {
                const qty = Number(itm.jumlah) || 0;
                keluar += qty;
                const jns = itm.jenis_pengeluaran || t.jenis_pengeluaran || 'habis_pakai';
                if (jns === 'rusak') rusak += qty;
                else if (jns === 'usang') usang += qty;

                const timName = (t.tim_pemohon || t.nama_tim || '').toLowerCase();
                if (timName.includes('umum')) tim.umum += qty;
                else if (timName.includes('sosial')) tim.sosial += qty;
                else if (timName.includes('ipds')) tim.ipds += qty;
                else if (timName.includes('tani') || timName.includes('pertanian')) tim.pertanian += qty;
                else if (timName.includes('dist')) tim.distribusi += qty;
                else if (timName.includes('neraca') || timName.includes('nerwilis')) tim.neraca += qty;
                else if (timName.includes('pek') || timName.includes('ktip')) tim.pek += qty;
              }
            });
          }
        });

        return { beli, transfer, keluar, rusak, usang, tim };
      };

      // Saldo Awal: seluruh transaksi masuk dikurangi keluar sebelum periode target
      let masukSebelum = 0;
      transaksiMasukList.forEach(t => {
        if (isBeforeMonthYear(t.tanggal, targetBulan, targetTahun)) {
          t.items?.forEach(itm => {
            const isMatch =
              String(itm.id_barang) === String(b.id) ||
              (itm.barang?.id && String(itm.barang.id) === String(b.id)) ||
              (itm.barang?.nama_barang && itm.barang.nama_barang.trim().toLowerCase() === b.nama_barang.trim().toLowerCase());
            if (isMatch) {
              masukSebelum += Number(itm.jumlah) || 0;
            }
          });
        }
      });

      let keluarSebelum = 0;
      transaksiKeluarList.forEach(t => {
        if (t.status === 'pending' || t.status === 'rejected') return;
        if (isBeforeMonthYear(t.tanggal, targetBulan, targetTahun)) {
          t.items?.forEach(itm => {
            const isMatch =
              String(itm.id_barang) === String(b.id) ||
              (itm.barang?.id && String(itm.barang.id) === String(b.id)) ||
              (itm.barang?.nama_barang && itm.barang.nama_barang.trim().toLowerCase() === b.nama_barang.trim().toLowerCase());
            if (isMatch) {
              keluarSebelum += Number(itm.jumlah) || 0;
            }
          });
        }
      });

      const baseStokAwal = Number((b as any)?.stok_awal) || 0;
      const saldoAwal = Math.max(0, baseStokAwal + masukSebelum - keluarSebelum);
      const curMutasi = getMonthMutasi(targetBulan, targetTahun);
      const pembelian = curMutasi.beli;
      const transferMasuk = curMutasi.transfer;
      const pengeluaran = curMutasi.keluar;
      const barangRusak = curMutasi.rusak;
      const barangUsang = curMutasi.usang;
      const timDist = curMutasi.tim;

      // Rumus resmi BPS: Total Persediaan = Saldo Awal + Pembelian + Transfer Masuk - Pengeluaran
      const total = Math.max(0, saldoAwal + pembelian + transferMasuk - pengeluaran);

      return {
        no: i + 1,
        uraian_barang: b.nama_barang,
        satuan: b.satuan?.nama_satuan || 'Buah',
        saldo_juli: saldoAwal, // Menyimpan nilai saldo awal periode
        pembelian,
        transfer_masuk: transferMasuk,
        pengeluaran,
        total_persediaan: total,
        barang_rusak: barangRusak,
        barang_usang: barangUsang,
        tim: {
          ...timDist,
          sisa: total,
        },
      };
    })
      .filter(item => item.saldo_juli > 0 || item.pembelian > 0 || item.transfer_masuk > 0 || item.pengeluaran > 0 || item.total_persediaan > 0)
      .map((item, idx) => ({
        ...item,
        no: idx + 1,
      }));
  };

  // Data Rekapitulasi State
  const [reportData, setReportData] = useState<RekapitulasiAgustusItem[]>([]);

  useEffect(() => {
    setReportData(getComputedReportData(bulan, tahun));
  }, [bulan, tahun, barangList, transaksiMasukList, transaksiKeluarList]);

  // Handler jika ganti bulan
  const handleBulanChange = (newBulan: number) => {
    setBulan(newBulan);
    const lastDay = new Date(tahun, newBulan, 0).getDate();
    setTglCetakDokumen(`${tahun}-${String(newBulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  // Handler jika ganti tahun
  const handleTahunChange = (newTahun: number) => {
    setTahun(newTahun);
    const lastDay = new Date(newTahun, bulan, 0).getDate();
    setTglCetakDokumen(`${newTahun}-${String(bulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const availableYears = getAvailableYears(
    [
      ...transaksiMasukList.map(t => t.tanggal),
      ...transaksiKeluarList.map(t => t.tanggal),
    ],
    customYears
  );

  const handleSelectYearOption = (val: string) => {
    if (val === 'custom') {
      setInputCustomYear('');
      setCustomYearError('');
      setShowAddYearModal(true);
    } else {
      handleTahunChange(Number(val));
    }
  };

  const handleSaveCustomYear = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = parseInt(inputCustomYear.trim(), 10);
    if (isNaN(yr) || yr < 2020 || yr > 2099) {
      setCustomYearError('Masukkan 4 digit tahun valid (2020 - 2099)');
      return;
    }
    saveCustomYear(yr);
    setCustomYears(prev => Array.from(new Set([...prev, yr])).sort((a, b) => a - b));
    handleTahunChange(yr);
    setShowAddYearModal(false);
    setToastNotification(`Tahun ${yr} berhasil ditambahkan dan dipilih!`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // STRICT FILTER: Barang yang total persediaannya 0 (habis) dihilangkan dari laporan & nomor urut berurutan runtut
  const activeReportData = reportData
    .filter((item) => Number(item.total_persediaan || 0) > 0)
    .map((item, idx) => ({ ...item, no: idx + 1 }));

  // Ringkasan Total bersumber dari activeReportData
  const totalSaldoAwal = activeReportData.reduce((s, i) => s + (i.saldo_juli || 0), 0);
  const totalPembelian = activeReportData.reduce((s, i) => s + (i.pembelian || 0), 0);
  const totalTransferMasuk = activeReportData.reduce((s, i) => s + (i.transfer_masuk || 0), 0);
  const totalPengeluaran = activeReportData.reduce((s, i) => s + (i.pengeluaran || 0), 0);
  const totalPersediaan = activeReportData.reduce((s, i) => s + (i.total_persediaan || 0), 0);
  const totalRusak = activeReportData.reduce((s, i) => s + (i.barang_rusak || 0), 0);
  const totalUsang = activeReportData.reduce((s, i) => s + (i.barang_usang || 0), 0);

  // Pengaturan Responsif Cetak agar 1 Halaman Full A4 Menyesuaikan Jumlah Baris
  const rowCount = activeReportData.length;
  const printCellPadding =
    rowCount <= 6
      ? 'print:py-3.5'
      : rowCount <= 10
        ? 'print:py-2.5'
        : rowCount <= 16
          ? 'print:py-1.5'
          : 'print:py-1';

  const printTableFontSize = 'print:text-[7pt]';



  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="page-enter space-y-6">
      {/* Konten Dashboard (Disembunyikan saat mencetak dokumen) */}
      <div className="print:hidden no-print space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-800">Laporan Persediaan &amp; Stock Opname</h1>
            <p className="text-sm text-dark-400 mt-1">
              Rekapitulasi fisik persediaan barang bulanan — Berita Acara &amp; Rincian per Tim Kerja
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(true)} className="btn-primary">
              <Printer className="w-4 h-4" />
              Cetak {activeTab === 'opname' ? 'Berita Acara Opname' : 'Rekapitulasi Tim'}
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastNotification && (
          <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-slide-in-up">
            <Check className="w-4 h-4" />
            <span>{toastNotification}</span>
          </div>
        )}

        {/* Filter Periode & Mode Tab */}
        <div className="card p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="input-label">Periode Rekapitulasi (Bulan)</label>
                <select
                  value={bulan}
                  onChange={(e) => handleBulanChange(Number(e.target.value))}
                  className="input w-52 font-semibold text-bps-blue"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Tahun</label>
                <select
                  value={tahun}
                  onChange={(e) => handleSelectYearOption(e.target.value)}
                  className="input w-36 font-semibold"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                  <option value="custom" className="font-bold text-bps-blue">
                    + Tambah Tahun Lain...
                  </option>
                </select>
              </div>
              <button
                onClick={() => setShowPreview(true)}
                className="btn-secondary"
              >
                <FileBarChart className="w-4 h-4" />
                Preview Cetak
              </button>
            </div>

            {/* Toggle Tab Tampilan Laporan */}
            <div className="flex items-center bg-dark-100 p-1 rounded-xl self-start md:self-auto">
              <button
                onClick={() => setActiveTab('opname')}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all',
                  activeTab === 'opname'
                    ? 'bg-white text-bps-blue shadow-sm'
                    : 'text-dark-500 hover:text-dark-800'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Berita Acara Opname Fisik
              </button>
              <button
                onClick={() => setActiveTab('tim')}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all',
                  activeTab === 'tim'
                    ? 'bg-white text-bps-blue shadow-sm'
                    : 'text-dark-500 hover:text-dark-800'
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Rekapitulasi per Tim (Sakernas/Susenas)
              </button>
            </div>
          </div>

          <div className="bg-bps-blue-50 border border-bps-blue-200 rounded-lg p-3 text-xs text-bps-blue-800 flex items-center justify-between">
            <span>
              ℹ️ Menampilkan <strong>{activeReportData.length} item barang</strong> resmi dari Rekapitulasi Persediaan BPS Kabupaten OKU Selatan — Periode <strong>{getMonthName(bulan)} {tahun}</strong>.
            </span>
            <span className="font-semibold text-bps-blue">Status: Sinkron &amp; Terverifikasi</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bps-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-bps-blue" />
            </div>
            <div>
              <p className="text-xl font-bold text-dark-800">{reportData.length}</p>
              <p className="text-xs text-dark-400">Total Jenis Barang</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bps-green-50 flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-bps-green" />
            </div>
            <div>
              <p className="text-xl font-bold text-bps-green">{totalPembelian + totalTransferMasuk}</p>
              <p className="text-xs text-dark-400">Total Masuk ({getMonthName(bulan)})</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bps-orange-50 flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-bps-orange" />
            </div>
            <div>
              <p className="text-xl font-bold text-bps-orange">{totalPengeluaran}</p>
              <p className="text-xs text-dark-400">Total Pengeluaran</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bps-teal-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-bps-teal" />
            </div>
            <div>
              <p className="text-xl font-bold text-dark-800">{formatNumber(totalPersediaan)}</p>
              <p className="text-xs text-dark-400">Sisa Persediaan Fisik</p>
            </div>
          </div>
        </div>

        {/* TAB 1: Berita Acara Hasil Opname Phisik (Stock Opname) */}
        {activeTab === 'opname' && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-dark-800">
                  Berita Acara Hasil Opname Phisik Persediaan — {getMonthName(bulan)} {tahun}
                </h2>
                <p className="text-xs text-dark-400 mt-0.5">
                  Formula: {getSaldoAwalHeader(bulan, tahun)} + Pembelian + Transfer Masuk - Pengeluaran = Total Persediaan
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPreview(true)} className="btn-primary text-xs py-1.5 px-3">
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Berita Acara
                </button>
              </div>
            </div>

            <div className="table-container border-0 max-h-[600px] overflow-y-auto">
              <table>
                <thead className="sticky top-0 bg-dark-50 z-10 shadow-sm">
                  <tr>
                    <th className="w-12 text-center">No</th>
                    <th>Uraian Barang</th>
                    <th className="text-center w-24">Satuan</th>
                    <th className="text-center w-28">{getSaldoAwalHeader(bulan, tahun)}</th>
                    <th className="text-center w-24 text-bps-blue-700">Pembelian</th>
                    <th className="text-center w-24 text-bps-green-700">Transfer Masuk</th>
                    <th className="text-center w-24 text-bps-orange-700">Pengeluaran</th>
                    <th className="text-center w-28 font-bold">Total Persediaan</th>
                    <th className="text-center w-20">Rusak</th>
                    <th className="text-center w-20">Usang</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReportData.map((item, idx) => (
                    <tr key={idx} className={item.pengeluaran > 0 ? 'bg-bps-orange-50/20' : ''}>
                      <td className="text-center text-dark-400 text-xs font-semibold">{item.no}</td>
                      <td className="font-medium text-dark-800 text-xs">{item.uraian_barang}</td>
                      <td className="text-center text-dark-600 text-xs">{item.satuan}</td>

                      {/* Saldo Awal */}
                      <td className="text-center text-xs font-medium">
                        {item.saldo_juli || '-'}
                      </td>

                      {/* Pembelian */}
                      <td className="text-center text-xs text-bps-blue font-semibold">
                        {item.pembelian || '-'}
                      </td>

                      {/* Transfer Masuk */}
                      <td className="text-center text-xs text-bps-green font-semibold">
                        {item.transfer_masuk || '-'}
                      </td>

                      {/* Pengeluaran */}
                      <td className="text-center text-xs text-bps-orange font-bold">
                        {item.pengeluaran || '-'}
                      </td>

                      {/* Total Persediaan */}
                      <td className="text-center text-xs font-bold text-dark-900 bg-dark-50/50">
                        {item.total_persediaan}
                      </td>

                      {/* Rusak */}
                      <td className="text-center text-xs text-dark-400">
                        {item.barang_rusak || '-'}
                      </td>

                      {/* Usang */}
                      <td className="text-center text-xs text-dark-400">
                        {item.barang_usang || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-dark-100 font-bold text-xs shadow-md">
                  <tr>
                    <td colSpan={3} className="text-right px-4 py-2 text-dark-700">TOTAL</td>
                    <td className="text-center px-2 py-2">{formatNumber(totalSaldoAwal)}</td>
                    <td className="text-center px-2 py-2 text-bps-blue">{formatNumber(totalPembelian)}</td>
                    <td className="text-center px-2 py-2 text-bps-green">{formatNumber(totalTransferMasuk)}</td>
                    <td className="text-center px-2 py-2 text-bps-orange">{formatNumber(totalPengeluaran)}</td>
                    <td className="text-center px-2 py-2 text-dark-900 font-extrabold">{formatNumber(totalPersediaan)}</td>
                    <td className="text-center px-2 py-2 text-dark-500">{totalRusak}</td>
                    <td className="text-center px-2 py-2 text-dark-500">{totalUsang}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Rincian Pengeluaran per Tim Kerja (Format Excel Mbak Guspita Sakernas/Susenas SE) */}
        {activeTab === 'tim' && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-dark-800">
                  Rekapitulasi Pengeluaran Barang per Tim — {getMonthName(bulan)} {tahun}
                </h2>
                <p className="text-xs text-dark-400 mt-0.5">
                  Distribusi pemakaian barang untuk kegiatan Sakernas, Susenas, SE, dan Operasional Rutin
                </p>
              </div>
              <button onClick={() => setShowPreview(true)} className="btn-primary text-xs py-1.5 px-3">
                <Printer className="w-3.5 h-3.5" />
                Cetak Rekapitulasi Tim
              </button>
            </div>

            <div className="table-container border-0 max-h-[600px] overflow-y-auto">
              <table>
                <thead className="sticky top-0 bg-dark-50 z-10 shadow-sm text-[11px]">
                  <tr>
                    <th rowSpan={2} className="w-10 text-center">No</th>
                    <th rowSpan={2}>Uraian Barang</th>
                    <th rowSpan={2} className="text-center text-bps-orange-700 bg-bps-orange-50/50">Total Keluar</th>
                    <th colSpan={7} className="text-center bg-bps-blue-50/50 text-bps-blue-800">
                      Rincian Alokasi per Tim Kerja
                    </th>
                    <th rowSpan={2} className="text-center w-20">Satuan</th>
                    <th rowSpan={2} className="text-center w-16">Sisa</th>
                  </tr>
                  <tr>
                    <th className="text-center text-dark-700">Subbag Umum</th>
                    <th className="text-center text-dark-700">Sosial</th>
                    <th className="text-center text-dark-700">IPDS</th>
                    <th className="text-center text-dark-700">Pertanian</th>
                    <th className="text-center text-dark-700">Distribusi</th>
                    <th className="text-center text-dark-700">Neraca</th>
                    <th className="text-center text-dark-700">PEK/KTIP</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReportData.map((item, idx) => (
                    <tr key={idx} className={item.pengeluaran > 0 ? 'bg-bps-blue-50/10' : ''}>
                      <td className="text-center text-dark-400 text-xs">{item.no}</td>
                      <td className="font-medium text-dark-800 text-xs">{item.uraian_barang}</td>
                      <td className="text-center font-bold text-bps-orange text-xs bg-bps-orange-50/30">
                        {item.pengeluaran > 0 ? item.pengeluaran : '-'}
                      </td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.umum || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.sosial || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.ipds || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.pertanian || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.distribusi || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.neraca || '-'}</td>
                      <td className="text-center text-xs text-dark-600">{item.tim?.pek || '-'}</td>
                      <td className="text-center text-xs text-dark-500">{item.satuan}</td>
                      <td className="text-center text-xs font-semibold text-dark-700">{item.tim?.sisa || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview Cetak — Sesuai Format File 1 Gambar Dokumen Mbak Guspita */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-4 border-b border-dark-100 no-print sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-bps-blue" />
                <h2 className="text-base font-bold text-dark-800">
                  {activeTab === 'opname'
                    ? 'Preview Cetak: Berita Acara Hasil Opname Phisik Persediaan'
                    : 'Preview Cetak: Rekapitulasi Pengeluaran per Tim Kerja'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-dark-50 border border-dark-200 rounded-lg px-2.5 py-1">
                  <span className="text-xs font-medium text-dark-600">Tanggal Dokumen:</span>
                  <input
                    type="date"
                    value={tglCetakDokumen}
                    onChange={(e) => setTglCetakDokumen(e.target.value)}
                    className="text-xs bg-white border border-dark-300 rounded px-1.5 py-0.5 text-dark-800 focus:outline-none focus:ring-1 focus:ring-bps-blue"
                    title="Pilih tanggal cetak (hari dan tanggal pada dokumen akan menyesuaikan otomatis)"
                  />
                </div>
                <button onClick={handlePrint} className="btn-primary text-xs py-2 px-3">
                  <Printer className="w-4 h-4" /> Cetak Dokumen
                </button>
                <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <style dangerouslySetInnerHTML={{
              __html: `
              /* Margin cetak proporsional A4: halaman 2 dan seterusnya tidak mepet ke tepi atas kertas */
              @page {
                size: A4 portrait;
                margin: 8mm 10mm 8mm 10mm; 
              }
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm 8mm 10mm;
                }
                .no-print,
                .print\\:hidden,
                header,
                aside,
                nav,
                footer {
                  display: none !important;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .avoid-break {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                #print-area {
                  padding: 0 1.5mm !important; 
                  margin: 0 !important;
                  width: 100% !important;
                  display: block !important; 
                  box-sizing: border-box !important;
                }
                table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  border: 1px solid #000000 !important;
                  page-break-inside: auto !important;
                }
                th, td {
                  border: 1px solid #000000 !important;
                  padding-top: 1.5px !important;
                  padding-bottom: 1.5px !important;
                  line-height: 1.15 !important;
                }
                th:last-child,
                td:last-child {
                  border-right: 1px solid #000000 !important;
                }
                thead {
                  display: table-header-group !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .signature-block {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  margin-top: 10px !important;
                  font-size: 9pt !important;
                  line-height: 1.25 !important;
                }
                .signature-block .sig-space {
                  height: 38px !important;
                  min-height: 38px !important;
                  max-height: 38px !important;
                }
              }
            `}} />

            <div className="p-8 print:p-0 text-black bg-white" id="print-area">
              {/* Kop Surat hanya muncul untuk Rekapitulasi Tim, TIDAK untuk Berita Acara Opname */}
              {activeTab === 'tim' && <KopSurat />}

              {/* Judul & Pengantar Resmi Berita Acara - Diberikan jarak / spasi jelas dan proporsional */}
              <div className="text-center mb-4 print:mb-2">
                <h3 className="font-extrabold text-sm md:text-base tracking-wide text-black uppercase mb-2 print:mb-1.5">
                  BERITA ACARA HASIL OPNAME PHISIK (STOCK OPNAME) PERSEDIAAN
                </h3>
                <p
                  style={{ textIndent: '2.5rem', overflowWrap: 'break-word', wordBreak: 'break-word', width: '100%', display: 'block' }}
                  className="text-xs print:text-[9.5pt] text-black mb-3 print:mb-2 leading-relaxed text-justify"
                >
                  {getTeksBeritaAcaraOpname(tglCetakDokumen)}
                </p>
              </div>

              {/* TAMPILAN CETAK TABEL 1: BERITA ACARA OPNAME PHISIK (Pas 100% A4, Kolom 10 Tidak Terpotong) */}
              {activeTab === 'opname' && (
                <table
                  style={{ width: '100%', tableLayout: 'fixed' }}
                  className={cn("w-full border-collapse border border-black text-[9px] print:text-[8pt] mb-4 print:mb-3", printTableFontSize)}
                >
                  <thead>
                    <tr className="bg-gray-100 text-black font-bold text-center leading-tight">
                      <th style={{ width: '4%', whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">No.</th>
                      <th style={{ width: '26%', overflow: 'hidden' }} className="border border-black px-1.5 py-1.5 text-center">Uraian Barang</th>
                      <th style={{ width: '7%', whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Satuan</th>
                      <th style={{ width: '9%', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">{getSaldoAwalHeader(bulan, tahun)}</th>
                      <th style={{ width: '8%', whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Pembelian</th>
                      <th style={{ width: '9%', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Transfer Masuk</th>
                      <th style={{ width: '9%', whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Pengeluaran</th>
                      <th style={{ width: '9%', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Total Persediaan</th>
                      <th style={{ width: '9%', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Barang Rusak</th>
                      <th style={{ width: '10%', overflow: 'hidden' }} className="border border-black px-1 py-1.5 text-center">Barang Usang</th>
                    </tr>
                    <tr className="bg-gray-50 text-[6pt] print:text-[6pt] text-gray-700 font-semibold text-center h-4 leading-none">
                      <th style={{ width: '4%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(1)</th>
                      <th style={{ width: '26%' }} className="border border-black py-0.5 px-0.5 leading-none">(2)</th>
                      <th style={{ width: '7%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(3)</th>
                      <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(4)</th>
                      <th style={{ width: '8%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(5)</th>
                      <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(6)</th>
                      <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(7)</th>
                      <th style={{ width: '9%' }} className="border border-black py-0.5 px-0.5 leading-none">(8)=(4)+(5)+(6)-(7)</th>
                      <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(9)</th>
                      <th style={{ width: '10%', whiteSpace: 'nowrap' }} className="border border-black py-0.5 px-0.5 leading-none">(10)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReportData.map((item) => (
                      <tr key={item.no} className="text-black leading-tight">
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center font-medium">{item.no}</td>
                        <td style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }} className="border border-black px-1.5 py-1 text-center font-medium">{item.uraian_barang}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.satuan}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.saldo_juli || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.pembelian || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.transfer_masuk || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center font-semibold">{item.pengeluaran || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center font-bold">{item.total_persediaan}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.barang_rusak || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} className="border border-black px-1 py-1 text-center">{item.barang_usang || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* TAMPILAN CETAK TABEL 2: RINCIAN PER TIM KERJA (Pas 100% A4) */}
              {activeTab === 'tim' && (
                <table
                  style={{ width: '100%', tableLayout: 'fixed' }}
                  className={cn("w-full border-collapse border border-black text-[9px] print:text-[8pt] mb-4 print:mb-3", printTableFontSize)}
                >
                  <thead>
                    <tr className="bg-gray-100 text-black font-bold text-center leading-tight">
                      <th rowSpan={2} style={{ width: '3.5%' }} className="border border-black px-1 py-1">No.</th>
                      <th rowSpan={2} style={{ width: '23.5%' }} className="border border-black px-1.5 py-1 text-center">Uraian Barang</th>
                      <th rowSpan={2} style={{ width: '8%' }} className="border border-black px-1 py-1 text-center">Pengeluaran</th>
                      <th colSpan={7} style={{ width: '49%' }} className="border border-black px-1 py-1 text-center">Rincian Tim Kerja</th>
                      <th rowSpan={2} style={{ width: '8%' }} className="border border-black px-1 py-1 text-center">Satuan</th>
                      <th rowSpan={2} style={{ width: '8%' }} className="border border-black px-1 py-1 text-center">Sisa</th>
                    </tr>
                    <tr className="bg-gray-50 text-[7pt] print:text-[7pt] text-gray-700 font-bold text-center h-3">
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Subbag Umum</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Tim Sosial</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">IPDS</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Pertanian</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Distribusi</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Neraca</th>
                      <th style={{ width: '7%' }} className="border border-black px-0.5 py-0.5 break-words">Tim PEK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReportData.map((item) => (
                      <tr key={item.no} className="text-black leading-tight">
                        <td className="border border-black px-1 py-1 text-center font-medium">{item.no}</td>
                        <td className="border border-black px-1.5 py-1 text-center font-medium break-words">{item.uraian_barang}</td>
                        <td className="border border-black px-1 py-1 text-center font-bold">{item.pengeluaran || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.umum || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.sosial || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.ipds || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.pertanian || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.distribusi || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.neraca || '-'}</td>
                        <td className="border border-black px-0.5 py-1 text-center">{item.tim?.pek || '-'}</td>
                        <td className="border border-black px-1 py-1 text-center">{item.satuan}</td>
                        <td className="border border-black px-1 py-1 text-center font-semibold">{item.tim?.sisa || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Tanda Tangan Format Resmi BPS (.signature-block seragam) */}
              <div className="signature-block">
                {/* Kolom Kiri: Mengetahui KPB */}
                <div className="sig-col">
                  <p className="sig-title">Mengetahui,</p>
                  <p>Kuasa Pengguna Barang</p>
                  <p>Kepala BPS Kabupaten OKU Selatan</p>
                  <div className="sig-space" />
                  <p>
                    <span className="sig-name">
                      Rival Abdul Jabar, S.ST., M.Si.
                    </span>
                  </p>
                  <p className="sig-nip">NIP. 19831122 200701 1003</p>
                </div>

                {/* Kolom Kanan: Petugas Pengelola Persediaan */}
                <div className="sig-col">
                  <p>{formatTanggalTandaTangan(tglCetakDokumen)}</p>
                  <p className="sig-title">Petugas Pengelola Persediaan</p>
                  <p className="invisible select-none">-</p>
                  <div className="sig-space" />
                  <p>
                    <span className="sig-name">
                      Guspita Karleni, S.Si
                    </span>
                  </p>
                  <p className="sig-nip">NIP. 19970806 202521 2039</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Tahun Baru */}
      {showAddYearModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-slide-in-up">
            <div className="flex items-center justify-between pb-3 border-b border-dark-100">
              <h3 className="font-bold text-dark-800 text-sm">Tambah Tahun Laporan</h3>
              <button
                type="button"
                onClick={() => setShowAddYearModal(false)}
                className="text-dark-400 hover:text-dark-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomYear} className="mt-4 space-y-4">
              <div>
                <label className="input-label text-xs">Masukkan Angka Tahun</label>
                <input
                  type="number"
                  min="2020"
                  max="2099"
                  value={inputCustomYear}
                  onChange={(e) => {
                    setInputCustomYear(e.target.value);
                    setCustomYearError('');
                  }}
                  placeholder="Contoh: 2038"
                  className="input w-full font-bold text-center text-lg py-2 text-bps-blue"
                  autoFocus
                  required
                />
                {customYearError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{customYearError}</p>
                )}
                <p className="text-[11px] text-dark-400 mt-1.5">
                  Tahun ini akan otomatis tersimpan di daftar pilihan dan langsung diterapkan.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddYearModal(false)}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-4 font-bold"
                >
                  Simpan &amp; Terapkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
