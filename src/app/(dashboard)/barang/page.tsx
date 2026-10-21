'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, Plus, Search, Trash2, ArrowUpFromLine,
  ChevronLeft, ChevronRight, X, Eye, CheckCircle2,
  AlertTriangle, Filter, Check, Clock, Layers, Printer, FileText
} from 'lucide-react';
import { mockBarang, mockTransaksiKeluar } from '@/lib/mock-data';
import { TIM_PEMOHON_LIST, getStoredTimList, formatNamaPJ, TimPemohon } from '@/types';
import type { Barang, TransaksiKeluar } from '@/types';
import { formatNumber, cn } from '@/lib/utils';
import {
  fetchAndSyncBarang,
  pushBarang,
  deleteBarangRemote,
  updateBarangStockRemote,
  updateBarangFullRemote,
  pushTransaksiKeluar,
} from '@/lib/sync-service';

export default function BarangPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStok, setFilterStok] = useState<'' | 'tersedia' | 'habis'>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6); // Default 6 agar 11 item menghasilkan 2 halaman persis screenshot
  const [userRole, setUserRole] = useState<'admin' | 'user'>('admin');
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

  // Modal Admin Tambah/Edit
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Barang | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Barang | null>(null);

  // Form State Tambah/Edit Barang
  const [formNamaBarang, setFormNamaBarang] = useState('');
  const [formKodeBarang, setFormKodeBarang] = useState('');
  const [formKategori, setFormKategori] = useState('Alat Tulis Kantor');
  const [formSatuan, setFormSatuan] = useState('Buah');
  const [formLokasi, setFormLokasi] = useState('Gudang ATK');
  const [formStok, setFormStok] = useState(0);
  const [formStokMinimum, setFormStokMinimum] = useState(0);
  const [formDeskripsi, setFormDeskripsi] = useState('');

  // Dropdown options
  const [kategoriOptions, setKategoriOptions] = useState<string[]>([
    'Alat Tulis Kantor',
    'Peralatan Komputer',
    'Perlengkapan Rumah Tangga',
    'Alat Kebersihan',
    'Perlengkapan Cetakan',
    'Peralatan Elektronik',
  ]);
  const [satuanOptions, setSatuanOptions] = useState<string[]>([
    'Buah',
    'Rim',
    'Lusin',
    'Pak',
    'Dus',
    'Set',
    'Unit',
    'Lembar',
    'Roll',
    'Botol',
    'Kotak',
    'Batang',
    'Pcs',
  ]);
  const [lokasiOptions, setLokasiOptions] = useState<string[]>([
    'Gudang Utama',
    'Gudang ATK',
    'Rak Server',
    'Ruang Arsip',
  ]);

  // Modal Detail Barang (untuk User & Admin)
  const [detailItem, setDetailItem] = useState<Barang | null>(null);

  // Modal Permintaan Cepat ATK (khusus Role User)
  const [timList, setTimList] = useState<TimPemohon[]>(() => {
    if (typeof window !== 'undefined') return getStoredTimList();
    return TIM_PEMOHON_LIST;
  });
  const [quickRequestItem, setQuickRequestItem] = useState<Barang | null>(null);
  const [quickRequestTim, setQuickRequestTim] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sipersedia_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          const list = getStoredTimList();
          if (u.bidang && u.bidang !== 'Tim Statistik Sosial') {
            const m = list.find(t => t.id === u.bidang || t.nama_tim === u.bidang);
            if (m) return m.id;
          }
          return list[0]?.id || 'tim-umum';
        } catch {}
      }
    }
    return 'tim-umum';
  });
  const [quickRequestJumlah, setQuickRequestJumlah] = useState(1);
  const [quickRequestKeterangan, setQuickRequestKeterangan] = useState('');

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: 'success' | 'info';
    message: string;
    docNo?: string;
  } | null>(null);

  useEffect(() => {
    const handleTimUpdate = () => {
      setTimList(getStoredTimList());
    };
    window.addEventListener('timListUpdated', handleTimUpdate);
    window.addEventListener('storage', handleTimUpdate);

    const stored = localStorage.getItem('sipersedia_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUserRole(u.role);
        if (u.bidang && u.bidang !== 'Tim Statistik Sosial') {
          const list = getStoredTimList();
          const m = list.find(t => t.id === u.bidang || t.nama_tim === u.bidang);
          if (m) setQuickRequestTim(m.id);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Ambil kata kunci pencarian dari URL jika diarahkan dari Header Search
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('search');
      if (q) setSearchQuery(q);
    }

    // Load barang dari localStorage jika ada
    const storedBarang = localStorage.getItem('sipersedia_barang_list');
    if (storedBarang !== null) {
      try {
        const parsed = JSON.parse(storedBarang);
        if (Array.isArray(parsed)) {
          setBarangList(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Hanya inisialisasi default jika memang belum ada data sama sekali di localStorage
      setBarangList(mockBarang);
      localStorage.setItem('sipersedia_barang_list', JSON.stringify(mockBarang));
    }

    // Sinkronisasi opsi kategori dari master data jika ada
    const storedKat = localStorage.getItem('sipersedia_kategori_list');
    if (storedKat) {
      try {
        const parsed = JSON.parse(storedKat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((k: any) => k.nama).filter(Boolean);
          setKategoriOptions((prev) => Array.from(new Set([...names, ...prev])));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Sinkronisasi opsi satuan dari master data jika ada
    const storedSat = localStorage.getItem('sipersedia_satuan_list');
    if (storedSat) {
      try {
        const parsed = JSON.parse(storedSat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((s: any) => s.nama).filter(Boolean);
          setSatuanOptions((prev) => Array.from(new Set([...names, ...prev])));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Sinkronisasi opsi lokasi dari master data jika ada
    const storedLok = localStorage.getItem('sipersedia_lokasi_list');
    if (storedLok) {
      try {
        const parsed = JSON.parse(storedLok);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((l: any) => l.nama).filter(Boolean);
          setLokasiOptions((prev) => Array.from(new Set([...names, ...prev])));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Tarik data barang resmi terbaru dari Cloud Database Supabase
    fetchAndSyncBarang().then((cloudBarang) => {
      if (cloudBarang && cloudBarang.length > 0) {
        setBarangList(cloudBarang);
      }
    });

    // Polling sinkronisasi real-time setiap 7 detik
    const syncInterval = setInterval(() => {
      // Jangan overwrite jika update stok sedang berjalan (pakai flag global)
      if ((window as any).__stockUpdating) return;
      fetchAndSyncBarang().then((cloudBarang) => {
        if (cloudBarang && cloudBarang.length > 0) {
          setBarangList(cloudBarang);
        }
      });
    }, 7000);

    return () => clearInterval(syncInterval);
  }, []);

  const handleOpenAddBarang = () => {
    setEditItem(null);
    setFormNamaBarang('');
    setFormKodeBarang(''); // Opsional, pengguna boleh mengosongkan jika belum ada kode
    setFormKategori(kategoriOptions[0] || 'Alat Tulis Kantor');
    setFormSatuan(satuanOptions[0] || 'Buah');
    setFormLokasi(lokasiOptions[0] || 'Gudang ATK');
    setFormStok(0);
    setFormStokMinimum(0);
    setFormDeskripsi('');
    setShowModal(true);
  };

  const handleOpenEditBarang = (item: Barang) => {
    setEditItem(item);
    setFormNamaBarang(item.nama_barang);
    setFormKodeBarang(item.kode_barang);
    setFormKategori(item.kategori?.nama_kategori || 'Alat Tulis Kantor');
    setFormSatuan(item.satuan?.nama_satuan || 'Buah');
    setFormLokasi(item.lokasi?.nama_lokasi || 'Gudang ATK');
    setFormStok(item.stok);
    setFormStokMinimum(item.stok_minimum);
    setFormDeskripsi(item.deskripsi || '');
    setShowModal(true);
  };

  const handleSaveBarang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaBarang.trim()) {
      alert('Nama barang tidak boleh kosong!');
      return;
    }
    // Kode barang dibuat opsional sesuai revisi mentor
    const finalKode = formKodeBarang.trim() || '-';

    // Petakan nama kategori/satuan/lokasi terpilih ke id agar konsisten dengan cloud
    const finalKategoriId = kategoriOptions.findIndex(k => k === formKategori) + 1 || 1;
    const finalSatuanId = satuanOptions.findIndex(s => s === formSatuan) + 1 || 1;
    const finalLokasiId = lokasiOptions.findIndex(l => l === formLokasi) + 1 || 1;

    let updatedList: Barang[];
    if (editItem) {
      let targetObj: Barang | undefined;
      updatedList = barangList.map((b) => {
        if (b.id === editItem.id) {
          const u: Barang = {
            ...b,
            nama_barang: formNamaBarang.trim(),
            kode_barang: finalKode,
            id_kategori: finalKategoriId,
            id_satuan: finalSatuanId,
            id_lokasi: finalLokasiId,
            stok: Math.max(0, Number(formStok)),
            stok_minimum: Math.max(0, Number(formStokMinimum)),
            deskripsi: formDeskripsi.trim() || null,
            updated_at: new Date().toISOString().split('T')[0],
            kategori: {
              id: finalKategoriId,
              nama_kategori: formKategori,
              deskripsi: null,
              created_at: '',
            },
            satuan: {
              id: finalSatuanId,
              nama_satuan: formSatuan,
              created_at: '',
            },
            lokasi: {
              id: finalLokasiId,
              nama_lokasi: formLokasi,
              deskripsi: null,
              created_at: '',
            },
          };
          targetObj = u;
          return u;
        }
        return b;
      });
      if (targetObj) {
        // UPDATE penuh lewat PUT — perhitungan baseline stok di server ikut diperbarui
        updateBarangFullRemote(targetObj);
      }
      setNotification({
        type: 'success',
        message: `Data barang "${formNamaBarang.trim()}" berhasil diperbarui!`,
      });
    } else {
      const newItem: Barang = {
        id: Date.now(),
        kode_barang: finalKode,
        nama_barang: formNamaBarang.trim(),
        id_kategori: finalKategoriId,
        id_satuan: finalSatuanId,
        id_lokasi: finalLokasiId,
        stok: Math.max(0, Number(formStok)),
        stok_minimum: Math.max(0, Number(formStokMinimum)),
        foto_url: null,
        deskripsi: formDeskripsi.trim() || null,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0],
        kategori: {
          id: finalKategoriId,
          nama_kategori: formKategori,
          deskripsi: null,
          created_at: '',
        },
        satuan: {
          id: finalSatuanId,
          nama_satuan: formSatuan,
          created_at: '',
        },
        lokasi: {
          id: finalLokasiId,
          nama_lokasi: formLokasi,
          deskripsi: null,
          created_at: '',
        },
      };
      updatedList = [newItem, ...barangList];
      pushBarang(newItem);
      setNotification({
        type: 'success',
        message: `Barang "${formNamaBarang.trim()}" berhasil ditambahkan ke inventaris!`,
      });
    }

    setBarangList(updatedList);
    localStorage.setItem('sipersedia_barang_list', JSON.stringify(updatedList));
    setShowModal(false);
    setTimeout(() => setNotification(null), 4000);
  };

  const confirmDeleteBarang = () => {
    if (!deleteCandidate) return;
    const targetName = deleteCandidate.nama_barang;
    const targetId = deleteCandidate.id;
    const updated = barangList.filter((b) => b.id !== deleteCandidate.id);
    setBarangList(updated);
    localStorage.setItem('sipersedia_barang_list', JSON.stringify(updated));
    deleteBarangRemote(targetId);
    setDeleteCandidate(null);
    setNotification({
      type: 'info',
      message: `Barang "${targetName}" berhasil dihapus dari inventaris.`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const isUser = userRole === 'user';

  // Reset ke halaman 1 saat pencarian atau filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterKategori, filterStok]);

  // Filter Data Barang
  const filtered = barangList.filter((b) => {
    const matchSearch =
      b.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.kode_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.deskripsi && b.deskripsi.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchKategori = !filterKategori || b.kategori?.nama_kategori === filterKategori;

    let matchStok = true;
    if (filterStok === 'habis') {
      matchStok = b.stok === 0;
    } else if (filterStok === 'tersedia') {
      matchStok = b.stok > 0;
    }

    return matchSearch && matchKategori && matchStok;
  });

  // Perhitungan Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
  const paginatedItems = filtered.slice(startIndex, endIndex);

  const kategoriList = Array.from(
    new Set(barangList.map((b) => b.kategori?.nama_kategori).filter(Boolean))
  ) as string[];

  // Statistik Ketersediaan Barang
  const totalStokTersedia = barangList.filter((b) => b.stok > 0).length;
  const totalStokHabis = barangList.filter((b) => b.stok === 0).length;

  // Handler Submit Permintaan Cepat dari Katalog
  const handleQuickRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRequestItem) return;

    if (quickRequestJumlah <= 0) {
      alert('Jumlah permintaan minimal 1');
      return;
    }
    if (quickRequestJumlah > quickRequestItem.stok) {
      alert(
        `Jumlah permintaan (${quickRequestJumlah}) melebihi sisa stok yang tersedia (${quickRequestItem.stok} ${quickRequestItem.satuan?.nama_satuan})`
      );
      return;
    }

    const timObj = timList.find((t) => t.id === quickRequestTim) || timList[0] || TIM_PEMOHON_LIST[2];
    const today = new Date().toISOString().split('T')[0];

    // Ambil riwayat transaksi yang ada
    let existingTrx: TransaksiKeluar[] = [...mockTransaksiKeluar];
    const savedTrx = localStorage.getItem('sipersedia_transaksi_keluar');
    if (savedTrx) {
      try {
        existingTrx = JSON.parse(savedTrx);
      } catch (err) {
        console.error(err);
      }
    }

    const docNo = `BK-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(
      existingTrx.length + 1
    ).padStart(3, '0')}`;

    const newTrx: TransaksiKeluar = {
      id: Date.now(),
      no_dokumen: docNo,
      tanggal: today,
      tim_pemohon: timObj.id,
      nama_tim: timObj.nama_tim,
      penanggung_jawab: formatNamaPJ(timObj.penanggung_jawab),
      nip_pj: timObj.nip_pj,
      items: [
        {
          id_barang: quickRequestItem.id,
          jumlah: Number(quickRequestJumlah),
          keterangan: quickRequestKeterangan || `Permintaan mandiri katalog: ${quickRequestItem.nama_barang}`,
          barang: quickRequestItem,
        },
      ],
      keterangan: quickRequestKeterangan || `Permintaan dari Katalog oleh ${timObj.nama_tim}`,
      created_by: 'usr-001',
      created_at: new Date().toISOString(),
    };

    const updatedTrx = [newTrx, ...existingTrx];
    localStorage.setItem('sipersedia_transaksi_keluar', JSON.stringify(updatedTrx));

    // Kirim transaksi ke cloud database secara real-time
    // ponytail: Pengurangan stok gudang hanya saat disetujui (approval) oleh Admin di Transaksi Keluar agar tidak double deduction
    pushTransaksiKeluar(newTrx);

    const requestedName = quickRequestItem.nama_barang;
    const requestedQty = quickRequestJumlah;
    const requestedUnit = quickRequestItem.satuan?.nama_satuan || 'Pcs';

    setQuickRequestItem(null);
    setNotification({
      type: 'success',
      message: `Permintaan ${requestedName} (${requestedQty} ${requestedUnit}) berhasil dibuat dengan No. ${newTrx.no_dokumen}!`,
      docNo: newTrx.no_dokumen,
    });
    setTimeout(() => setNotification(null), 7000);
  };

  return (
    <div className="page-enter space-y-6">
      {/* Header — Disesuaikan untuk Admin vs Pegawai */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark-800">
              {isUser ? 'Katalog Stok Barang' : 'Data Master Barang'}
            </h1>
            <span
              className={cn(
                'text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                isUser ? 'bg-bps-blue-50 text-bps-blue border border-bps-blue/20' : 'bg-dark-100 text-dark-700'
              )}
            >
              {isUser ? 'Mode Pegawai' : 'Mode Admin'}
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-1">
            {isUser
              ? 'Pantau ketersediaan stok barang dan ATK, periksa sisa persediaan, serta ajukan permintaan langsung'
              : 'Kelola master data barang persediaan, stok minimum, dan lokasi penyimpanan gudang'}
          </p>
        </div>

        {isUser ? (
          <Link
            href="/transaksi-keluar"
            className="btn-primary inline-flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Formulir Permintaan ATK (SPB)</span>
          </Link>
        ) : (
          <Link
            href="/transaksi-masuk"
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
            title="Tambah barang master baru dan stok terpusat melalui Transaksi Masuk"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Masuk</span>
          </Link>
        )}
      </div>

      {/* Notification Toast Sukses */}
      {notification && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">{notification.message}</p>
              {notification.docNo && (
                <Link
                  href="/transaksi-keluar"
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium mt-0.5 inline-block"
                >
                  Lihat Surat Permintaan & Cetak Dokumen di Menu Transaksi →
                </Link>
              )}
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1.5 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Summary Chips Ketersediaan Barang */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setFilterStok('')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            filterStok === ''
              ? 'bg-bps-blue-50/60 border-bps-blue/40 shadow-xs ring-1 ring-bps-blue/20'
              : 'bg-white border-dark-100 hover:border-dark-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-500 font-medium">Semua Item</span>
            <Package className="w-4 h-4 text-bps-blue" />
          </div>
          <p className="text-xl font-bold text-dark-800 mt-1">{barangList.length}</p>
          <p className="text-[11px] text-dark-400">Total persediaan</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStok('tersedia')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            filterStok === 'tersedia'
              ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-1 ring-emerald-200'
              : 'bg-white border-dark-100 hover:border-dark-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-medium">Stok Tersedia</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-700 mt-1">{totalStokTersedia}</p>
          <p className="text-[11px] text-emerald-600/80">Stok fisik &gt; 0</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStok('habis')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            filterStok === 'habis'
              ? 'bg-red-50 border-red-300 shadow-xs ring-1 ring-red-200'
              : 'bg-white border-dark-100 hover:border-dark-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-700 font-medium">Stok Habis</span>
            <span className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <p className="text-xl font-bold text-red-700 mt-1">{totalStokHabis}</p>
          <p className="text-[11px] text-red-600/80">Perlu restock</p>
        </button>
      </div>

      {/* Filter & Pencarian */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 text-sm"
              placeholder="Cari kode atau nama barang ATK..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-dark-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="input text-sm w-full sm:w-48"
            >
              <option value="">Semua Kategori</option>
              {kategoriList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            {(searchQuery || filterKategori || filterStok) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterKategori('');
                  setFilterStok('');
                }}
                className="btn-secondary text-xs px-3 py-2 whitespace-nowrap"
                title="Reset semua filter"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Data Barang & Katalog */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Barang & Kode</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th>Lokasi</th>
                <th>Sisa Stok & Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const isOutOfStock = item.stok === 0;
                const isLowStock = item.stok > 0 && item.stok <= item.stok_minimum;

                return (
                  <tr key={item.id} className="hover:bg-dark-50/70 transition-colors">
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setDetailItem(item)}
                          className="w-10 h-10 rounded-xl bg-bps-blue-50/80 border border-bps-blue/10 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-bps-blue-100 transition-colors"
                          title="Klik untuk melihat detail barang"
                        >
                          <Package className="w-5 h-5 text-bps-blue" />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="font-semibold text-dark-800 hover:text-bps-blue transition-colors text-left"
                          >
                            {item.nama_barang}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px] text-dark-400">
                              Kode: {item.kode_barang}
                            </span>
                            {item.deskripsi && (
                              <>
                                <span className="text-dark-200">·</span>
                                <span className="text-xs text-dark-400 truncate max-w-[200px]" title={item.deskripsi}>
                                  {item.deskripsi}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-dark-50 text-dark-600 font-medium">
                        {item.kategori?.nama_kategori}
                      </span>
                    </td>
                    <td className="text-sm text-dark-600">{item.satuan?.nama_satuan}</td>
                    <td className="text-sm text-dark-600">{item.lokasi?.nama_lokasi}</td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-dark-800">
                            {formatNumber(item.stok)}
                          </span>
                          <span className="text-xs text-dark-400">
                            {item.satuan?.nama_satuan}
                          </span>
                          {/* Badge Status Ketersediaan */}
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              Habis
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Tersedia
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {isUser ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Minta Barang (Membuka Modal Permintaan Cepat) */}
                          {item.stok > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickRequestItem(item);
                                setQuickRequestJumlah(1);
                                setQuickRequestKeterangan('');
                                setQuickRequestTim('tim-sosial');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-bps-blue hover:bg-bps-blue-600 hover:shadow-md transition-all active:scale-95"
                              title={`Ajukan permintaan barang ${item.nama_barang}`}
                            >
                              <ArrowUpFromLine className="w-3.5 h-3.5" />
                              <span>Minta</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-dark-400 bg-dark-100 cursor-not-allowed"
                              title="Stok saat ini kosong"
                            >
                              Stok Habis
                            </span>
                          )}

                          {/* Tombol Lihat Detail */}
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-700 hover:bg-dark-100 transition-colors"
                            title="Lihat Detail Barang"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Detail */}
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="p-2 rounded-lg text-dark-500 hover:text-dark-800 hover:bg-dark-100 transition-colors"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Tombol Hapus Barang */}
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(item)}
                            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xs active:scale-95"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Package className="w-12 h-12 text-dark-200 mx-auto mb-3" />
                    <p className="text-dark-500 font-semibold text-sm">Tidak ada barang ditemukan</p>
                    <p className="text-dark-400 text-xs mt-1">
                      Coba ganti kata kunci pencarian atau sesuaikan filter kategori/stok.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Kontrol Pagination Interaktif (Sesuai Tampilan Screenshot yang Diminta) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-dark-100 bg-white">
          <div className="flex items-center gap-3">
            <p className="text-xs text-dark-500">
              Menampilkan{' '}
              <span className="font-semibold text-dark-800">
                {filtered.length === 0 ? 0 : startIndex + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-dark-800">{endIndex}</span> dari{' '}
              <span className="font-semibold text-dark-800">{filtered.length}</span> barang
            </p>
            <div className="h-4 w-[1px] bg-dark-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-dark-500">
              <span>Per halaman:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-dark-50 border border-dark-200 rounded-md px-2 py-0.5 text-xs text-dark-700 font-medium focus:outline-none focus:border-bps-blue cursor-pointer"
              >
                <option value={6}>6</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Tombol Prev (<) */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="p-1.5 rounded-md text-dark-500 hover:text-dark-800 hover:bg-dark-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Halaman Sebelumnya"
              aria-label="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Tombol Nomor Halaman Dinamis (1, 2, ...) */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                type="button"
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={cn(
                  'w-8 h-8 rounded-md text-xs font-semibold transition-all duration-150 flex items-center justify-center',
                  validCurrentPage === pageNum
                    ? 'bg-bps-blue text-white shadow-sm ring-2 ring-bps-blue/20'
                    : 'text-dark-600 hover:bg-dark-50 hover:text-dark-800 active:scale-95'
                )}
                title={`Ke Halaman ${pageNum}`}
              >
                {pageNum}
              </button>
            ))}

            {/* Tombol Next (>) */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="p-1.5 rounded-md text-dark-500 hover:text-dark-800 hover:bg-dark-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Halaman Berikutnya"
              aria-label="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Permintaan Cepat ATK (Untuk Pegawai Langsung dari Katalog) */}
      {quickRequestItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-bps-blue-50 flex items-center justify-center">
                  <ArrowUpFromLine className="w-5 h-5 text-bps-blue" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-dark-800">Ajukan Permintaan Barang</h2>
                  <p className="text-xs text-dark-400">Pengajuan cepat untuk Tim Kerja BPS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickRequestItem(null)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickRequestSubmit} className="p-5 space-y-4">
              {/* Dropdown Pilihan Item Barang */}
              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Pilih Item Barang Persediaan <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickRequestItem.id}
                  onChange={(e) => {
                    const selected = barangList.find((b) => b.id === Number(e.target.value));
                    if (selected) setQuickRequestItem(selected);
                  }}
                  className="input text-xs font-medium"
                >
                  {barangList.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.kode_barang}] {b.nama_barang} (Sisa Stok: {b.stok} {b.satuan?.nama_satuan || 'Buah'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Barang yang Diminta */}
              <div className="p-3.5 bg-bps-blue-50/60 rounded-xl border border-bps-blue/15 flex items-start gap-3">
                <Package className="w-5 h-5 text-bps-blue flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-dark-800 text-sm">{quickRequestItem.nama_barang}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-500 mt-1">
                    <span>Kode: <strong className="font-mono">{quickRequestItem.kode_barang}</strong></span>
                    <span>Kategori: <strong>{quickRequestItem.kategori?.nama_kategori}</strong></span>
                    <span>Lokasi: <strong>{quickRequestItem.lokasi?.nama_lokasi}</strong></span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-bps-blue/20 text-xs font-semibold text-bps-blue">
                    <span>Sisa Stok Tersedia:</span>
                    <strong className="text-dark-800 font-bold">
                      {quickRequestItem.stok} {quickRequestItem.satuan?.nama_satuan}
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Tim Pemohon BPS <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickRequestTim}
                  onChange={(e) => setQuickRequestTim(e.target.value)}
                  className="input text-xs font-medium text-dark-800"
                  required
                >
                  {timList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_tim} — PJ: {formatNamaPJ(t.penanggung_jawab)}
                    </option>
                  ))}
                </select>

                {/* Info Card Penanggung Jawab Tim yang Dipilih */}
                {(() => {
                  const activeTim = timList.find((t) => t.id === quickRequestTim) || timList[0] || TIM_PEMOHON_LIST[2];
                  return (
                    <div className="mt-2 p-2.5 bg-bps-blue-50/70 rounded-xl border border-bps-blue/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs animate-fade-in">
                      <div className="flex items-center gap-1.5">
                        <span className="text-dark-500 font-medium">Penanggung Jawab:</span>
                        <span className="font-bold text-dark-800">{formatNamaPJ(activeTim.penanggung_jawab)}</span>
                      </div>
                      <div className="text-dark-500 text-[11px]">
                        NIP: <span className="font-mono font-semibold text-dark-700">{activeTim.nip_pj}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Jumlah yang Diminta ({quickRequestItem.satuan?.nama_satuan}){' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={quickRequestItem.stok}
                    value={quickRequestJumlah}
                    onChange={(e) => setQuickRequestJumlah(Number(e.target.value))}
                    className="input text-xs font-bold w-32"
                    required
                  />
                  <span className="text-xs text-dark-500">
                    Maksimal {quickRequestItem.stok} {quickRequestItem.satuan?.nama_satuan}
                  </span>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Keperluan / Peruntukan Kegiatan
                </label>
                <textarea
                  value={quickRequestKeterangan}
                  onChange={(e) => setQuickRequestKeterangan(e.target.value)}
                  placeholder="Contoh: Kebutuhan persiapan pencacahan lapangan Susenas / Sakernas..."
                  className="input min-h-[75px] text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-dark-100">
                <Link
                  href={`/transaksi-keluar?barang_id=${quickRequestItem.id}&action=minta`}
                  className="text-xs text-bps-blue hover:underline font-semibold flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Buka di Formulir Lengkap (SPB)</span>
                </Link>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setQuickRequestItem(null)}
                    className="btn-secondary text-xs flex-1 sm:flex-initial"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kirim Permintaan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Barang (Untuk User & Admin) */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-bps-blue" />
                <h2 className="text-base font-bold text-dark-800">Detail Informasi Barang</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <span className="text-[11px] font-mono text-dark-400 uppercase tracking-wide">
                  Kode: {detailItem.kode_barang}
                </span>
                <h3 className="text-lg font-bold text-dark-800 mt-0.5">{detailItem.nama_barang}</h3>
                {detailItem.deskripsi && (
                  <p className="text-xs text-dark-500 mt-1 leading-relaxed">{detailItem.deskripsi}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-dark-50 rounded-xl space-y-1">
                  <span className="text-dark-400">Kategori:</span>
                  <p className="font-semibold text-dark-800">{detailItem.kategori?.nama_kategori}</p>
                </div>
                <div className="p-3 bg-dark-50 rounded-xl space-y-1">
                  <span className="text-dark-400">Satuan Barang:</span>
                  <p className="font-semibold text-dark-800">{detailItem.satuan?.nama_satuan}</p>
                </div>
                <div className="p-3 bg-dark-50 rounded-xl space-y-1">
                  <span className="text-dark-400">Lokasi Penyimpanan:</span>
                  <p className="font-semibold text-dark-800">{detailItem.lokasi?.nama_lokasi}</p>
                </div>
              </div>

              {/* Status Sisa Stok */}
              <div className="p-4 rounded-xl border border-dark-100 bg-gradient-to-r from-dark-50 to-white flex items-center justify-between">
                <div>
                  <span className="text-xs text-dark-400">Sisa Stok Fisik Gudang</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-dark-800">{detailItem.stok}</span>
                    <span className="text-xs font-semibold text-dark-500">
                      {detailItem.satuan?.nama_satuan}
                    </span>
                  </div>
                </div>
                <div>
                  {detailItem.stok === 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                      Stok Habis
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Stok Tersedia
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-dark-100 bg-dark-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="btn-secondary text-xs"
              >
                Tutup
              </button>
              {isUser && detailItem.stok > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const selected = detailItem;
                    setDetailItem(null);
                    setQuickRequestItem(selected);
                    setQuickRequestJumlah(1);
                    setQuickRequestKeterangan('');
                    setQuickRequestTim('tim-sosial');
                  }}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>Ajukan Permintaan Barang Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Barang (Khusus Admin) */}
      {!isUser && showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-bps-blue-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-bps-blue" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-dark-800">
                    {editItem ? 'Edit Barang Persediaan' : 'Tambah Barang Baru'}
                  </h2>
                  <p className="text-xs text-dark-400">Master inventaris gudang BPS OKU Selatan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBarang}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Nama Barang <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaBarang}
                      onChange={(e) => setFormNamaBarang(e.target.value)}
                      className="input text-sm"
                      placeholder="Contoh: Kertas HVS A4 70gsm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Kode Barang <span className="text-dark-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={formKodeBarang}
                      onChange={(e) => setFormKodeBarang(e.target.value)}
                      className="input text-sm font-mono"
                      placeholder="Contoh: 000001 (opsional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value)}
                      className="input text-sm"
                      required
                    >
                      {kategoriOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Satuan Ukuran <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formSatuan}
                      onChange={(e) => setFormSatuan(e.target.value)}
                      className="input text-sm"
                      required
                    >
                      {satuanOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Lokasi Rak/Gudang <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formLokasi}
                      onChange={(e) => setFormLokasi(e.target.value)}
                      className="input text-sm"
                      required
                    >
                      {lokasiOptions.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">
                      Stok Fisik Saat Ini (Bisa 0)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formStok}
                      onChange={(e) => setFormStok(Number(e.target.value))}
                      className="input text-sm font-semibold"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Deskripsi / Spesifikasi Barang (opsional)
                  </label>
                  <textarea
                    value={formDeskripsi}
                    onChange={(e) => setFormDeskripsi(e.target.value)}
                    className="input min-h-[85px] resize-none text-sm"
                    placeholder="Contoh: Merek Faber Castell, warna hitam, kemasan box..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-dark-100 bg-dark-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-sm"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-sm">
                  {editItem ? 'Simpan Perubahan' : 'Tambah Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Barang */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-in-up p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-dark-800">Hapus Barang?</h3>
              <p className="text-xs text-dark-500 mt-1">
                Apakah Anda yakin ingin menghapus barang{' '}
                <strong className="text-dark-800">"{deleteCandidate.nama_barang}"</strong>{' '}
                (Kode: <span className="font-mono">{deleteCandidate.kode_barang}</span>)?
              </p>
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] text-left">
                ⚠️ Sisa stok tercatat: <strong>{deleteCandidate.stok} {deleteCandidate.satuan?.nama_satuan}</strong>. Tindakan ini akan menghapus barang dari master data inventaris.
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="btn-secondary text-xs flex-1"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteBarang}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex-1 shadow-sm active:scale-95"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
