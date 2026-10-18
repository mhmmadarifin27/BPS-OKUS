'use client';

import { useState, useEffect } from 'react';
import {
  ArrowDownToLine, Plus, Search, Printer, Edit2, Trash2,
  FileText, Calendar, X, AlertTriangle, CheckCircle2, PlusCircle, Trash,
} from 'lucide-react';
import { mockTransaksiMasuk, mockBarang } from '@/lib/mock-data';
import type { TransaksiMasuk, SumberBarangMasuk, Barang } from '@/types';
import { cn, formatCurrency, formatDateShort, formatDate, formatTanggalTandaTangan } from '@/lib/utils';
import KopSurat from '@/components/KopSurat';
import {
  fetchAndSyncTransaksiMasuk,
  pushTransaksiMasuk,
  deleteTransaksiMasukRemote,
  fetchAndSyncBarang,
  updateBarangStockRemote,
  pushBarang,
} from '@/lib/sync-service';

interface FormMasukItem {
  id_barang: number | null;
  nama_barang: string;
  jumlah: number;
  keterangan: string;
  is_new?: boolean;
  satuan?: string;
  kategori?: string;
}

export default function TransaksiMasukPage() {
  const [transaksiList, setTransaksiList] = useState<TransaksiMasuk[]>([...mockTransaksiMasuk]);
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
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState<TransaksiMasuk | null>(null);
  const [editItem, setEditItem] = useState<TransaksiMasuk | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TransaksiMasuk | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Quick Add Master Barang Modal State
  const [showQuickAddBarang, setShowQuickAddBarang] = useState(false);
  const [quickAddIdx, setQuickAddIdx] = useState<number>(0);
  const [quickNamaBarang, setQuickNamaBarang] = useState('');
  const [quickKodeBarang, setQuickKodeBarang] = useState('');
  const [quickSatuan, setQuickSatuan] = useState('Buah');
  const [quickKategori, setQuickKategori] = useState('Alat Tulis Kantor');
  const [quickLokasi, setQuickLokasi] = useState('Gudang ATK');
  const [quickDeskripsi, setQuickDeskripsi] = useState('');

  // Dropdown master options
  const [kategoriOptions, setKategoriOptions] = useState<string[]>([
    'Alat Tulis Kantor', 'Peralatan Komputer', 'Perlengkapan Rumah Tangga',
    'Alat Kebersihan', 'Perlengkapan Cetakan', 'Peralatan Elektronik'
  ]);
  const [satuanOptions, setSatuanOptions] = useState<string[]>([
    'Buah', 'Rim', 'Lusin', 'Pak', 'Dus', 'Set', 'Unit', 'Lembar', 'Roll', 'Botol', 'Kotak', 'Batang'
  ]);
  const [lokasiOptions, setLokasiOptions] = useState<string[]>([
    'Gudang Utama', 'Gudang ATK', 'Rak Server', 'Ruang Arsip'
  ]);

  // Form State
  const [formSumber, setFormSumber] = useState<SumberBarangMasuk>('Pembelian');
  const [formTanggal, setFormTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNoReferensi, setFormNoReferensi] = useState<string>('');
  const [formItems, setFormItems] = useState<FormMasukItem[]>([
    { id_barang: null, nama_barang: '', jumlah: 1, keterangan: '', is_new: false, satuan: 'Buah', kategori: 'Alat Tulis Kantor' }
  ]);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [tglCetakDokumen, setTglCetakDokumen] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Load persisted incoming transactions
    const savedTrx = localStorage.getItem('sipersedia_transaksi_masuk');
    if (savedTrx) {
      try {
        const parsed = JSON.parse(savedTrx);
        if (Array.isArray(parsed)) {
          setTransaksiList(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify(mockTransaksiMasuk));
    }

    // Load master kategori, satuan, lokasi
    const katSaved = localStorage.getItem('sipersedia_kategori_list');
    if (katSaved) {
      try {
        const parsed = JSON.parse(katSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKategoriOptions(parsed.map((k: any) => k.nama || k.nama_kategori).filter(Boolean));
        }
      } catch {}
    }
    const satSaved = localStorage.getItem('sipersedia_satuan_list');
    if (satSaved) {
      try {
        const parsed = JSON.parse(satSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSatuanOptions(parsed.map((s: any) => s.nama || s.nama_satuan).filter(Boolean));
        }
      } catch {}
    }
    const lokSaved = localStorage.getItem('sipersedia_lokasi_list');
    if (lokSaved) {
      try {
        const parsed = JSON.parse(lokSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLokasiOptions(parsed.map((l: any) => l.nama || l.nama_lokasi).filter(Boolean));
        }
      } catch {}
    }

    let currentBarang = barangList;
    // Load barang list
    const savedBarang = localStorage.getItem('sipersedia_barang_list');
    if (savedBarang !== null) {
      try {
        const parsed = JSON.parse(savedBarang);
        if (Array.isArray(parsed)) {
          currentBarang = parsed;
          setBarangList(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Ambil data barang dari cloud
    fetchAndSyncBarang().then((cloudBarang) => {
      if (cloudBarang && cloudBarang.length > 0) {
        currentBarang = cloudBarang;
        setBarangList(cloudBarang);
      }
    });

    // Sinkronisasi data transaksi masuk dari cloud
    fetchAndSyncTransaksiMasuk(currentBarang).then((synced) => {
      if (synced) setTransaksiList(synced);
    });

    // Polling sync transaksi masuk setiap 6 detik
    const syncInterval = setInterval(() => {
      let latestBarang = currentBarang;
      if (typeof window !== 'undefined') {
        try {
          const localB = localStorage.getItem('sipersedia_barang_list');
          if (localB) {
            const parsed = JSON.parse(localB);
            if (Array.isArray(parsed) && parsed.length > 0) latestBarang = parsed;
          }
        } catch {}
      }
      fetchAndSyncTransaksiMasuk(latestBarang).then((synced) => {
        if (synced && synced.length > 0) {
          setTransaksiList(prev => {
            if (synced.length >= prev.length) return synced;
            const map = new Map<string, TransaksiMasuk>();
            prev.forEach(t => map.set(t.no_dokumen, t));
            synced.forEach(t => map.set(t.no_dokumen, t));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
            );
          });
        }
      });
    }, 6000);

    return () => clearInterval(syncInterval);
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const generateNextDocNo = (tanggal: string, list: TransaksiMasuk[]): string => {
    const d = new Date(tanggal || new Date());
    const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    const month = String(isNaN(d.getMonth()) ? (new Date().getMonth() + 1) : (d.getMonth() + 1)).padStart(2, '0');
    const prefix = `BM-${year}/${month}/`;

    const existingDocs = new Set<string>();
    list.forEach(t => { if (t?.no_dokumen) existingDocs.add(t.no_dokumen); });

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sipersedia_transaksi_masuk');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((t: any) => { if (t?.no_dokumen) existingDocs.add(t.no_dokumen); });
          }
        }
      } catch {}
    }

    let maxSeq = 0;
    existingDocs.forEach(doc => {
      if (doc && doc.startsWith(prefix)) {
        const part = doc.slice(prefix.length).split(/[^0-9]/)[0];
        const num = parseInt(part, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    if (existingDocs.has(candidate)) {
      return `${prefix}${String(nextSeq + 1).padStart(3, '0')}`;
    }
    return candidate;
  };

  const generateNextNoRef = (sumber: SumberBarangMasuk, tanggal: string, list: TransaksiMasuk[]): string => {
    const d = new Date(tanggal || new Date());
    const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    const month = String(isNaN(d.getMonth()) ? (new Date().getMonth() + 1) : (d.getMonth() + 1)).padStart(2, '0');
    const count = list.length + 1;
    if (sumber === 'Pembelian') {
      return `NOTA/${year}/${month}/${String(count).padStart(3, '0')}`;
    }
    return `BAST/BPS-SUMSEL/${year}/${month}/${String(count).padStart(3, '0')}`;
  };

  const filtered = transaksiList.filter(t =>
    t.no_dokumen.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.no_referensi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.items.some(item => item.barang?.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalItemsBulanIni = filtered.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.jumlah, 0), 0);
  const totalPembelianBulanIni = filtered.filter(t => t.sumber === 'Pembelian').length;
  const totalTransferBulanIni = filtered.filter(t => t.sumber === 'Transfer Masuk').length;

  const handleOpenAdd = () => {
    setEditItem(null);
    setFormSumber('Pembelian');
    const today = new Date().toISOString().split('T')[0];
    setFormTanggal(today);
    setFormNoReferensi(generateNextNoRef('Pembelian', today, transaksiList));
    setFormItems([
      { id_barang: null, nama_barang: '', jumlah: 1, keterangan: '', is_new: false, satuan: 'Buah', kategori: 'Alat Tulis Kantor' }
    ]);
    setFormKeterangan('');
    setActiveSearchIdx(null);
    setShowModal(true);
  };

  const handleSumberChange = (sumber: SumberBarangMasuk) => {
    setFormSumber(sumber);
    if (!editItem) {
      setFormNoReferensi(generateNextNoRef(sumber, formTanggal, transaksiList));
    }
  };

  const handleOpenEdit = (trx: TransaksiMasuk) => {
    setEditItem(trx);
    setFormSumber(trx.sumber);
    setFormTanggal(trx.tanggal);
    setFormNoReferensi(trx.no_referensi || '');
    setFormKeterangan(trx.keterangan || '');
    setActiveSearchIdx(null);
    if (trx.items && trx.items.length > 0) {
      setFormItems(trx.items.map(item => {
        const found = item.barang || barangList.find(b => b.id === item.id_barang);
        return {
          id_barang: item.id_barang,
          nama_barang: found?.nama_barang || `Barang #${item.id_barang}`,
          jumlah: item.jumlah,
          keterangan: item.keterangan || '',
          is_new: false,
          satuan: found?.satuan?.nama_satuan || 'Buah',
          kategori: found?.kategori?.nama_kategori || 'Alat Tulis Kantor',
        };
      }));
    } else {
      setFormItems([
        { id_barang: null, nama_barang: '', jumlah: 1, keterangan: '', is_new: false, satuan: 'Buah', kategori: 'Alat Tulis Kantor' }
      ]);
    }
    setShowModal(true);
  };

  const addFormItem = () => {
    setFormItems(prev => [
      ...prev,
      { id_barang: null, nama_barang: '', jumlah: 1, keterangan: '', is_new: false, satuan: 'Buah', kategori: 'Alat Tulis Kantor' }
    ]);
  };

  const removeFormItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateFormItem = (idx: number, field: keyof FormMasukItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Handler Tambah Cepat Barang Baru langsung dari formulir transaksi masuk
  const handleSaveQuickBarang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNamaBarang.trim()) {
      alert('Nama barang tidak boleh kosong!');
      return;
    }
    const maxId = barangList.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0);
    const nextId = (maxId || 81) + 1;
    const nextKode = quickKodeBarang.trim() || `000${String(nextId).padStart(3, '0')}`;
    const newB: Barang = {
      id: nextId,
      kode_barang: nextKode,
      nama_barang: quickNamaBarang.trim(),
      id_kategori: kategoriOptions.findIndex(k => k === quickKategori) + 1 || 1,
      id_satuan: satuanOptions.findIndex(s => s === quickSatuan) + 1 || 1,
      id_lokasi: lokasiOptions.findIndex(l => l === quickLokasi) + 1 || 1,
      stok: 0,
      stok_minimum: 0,
      foto_url: null,
      deskripsi: quickDeskripsi.trim() || 'Ditambahkan via Transaksi Masuk',
      created_at: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0],
      kategori: { id: 1, nama_kategori: quickKategori, deskripsi: null, created_at: '' },
      satuan: { id: 1, nama_satuan: quickSatuan, created_at: '' },
      lokasi: { id: 1, nama_lokasi: quickLokasi, deskripsi: null, created_at: '' },
    };
    const updatedBarang = [newB, ...barangList];
    setBarangList(updatedBarang);
    localStorage.setItem('sipersedia_barang_list', JSON.stringify(updatedBarang));
    pushBarang(newB);
    updateFormItem(quickAddIdx, 'id_barang', newB.id);
    setShowQuickAddBarang(false);
    setQuickNamaBarang('');
    setQuickKodeBarang('');
    setQuickDeskripsi('');
    showToast(`Barang baru "${newB.nama_barang}" berhasil didaftarkan ke Master Barang & langsung dipilih!`, 'success');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      alert('Tambahkan minimal 1 item barang');
      return;
    }

    // Validasi nama barang dan jumlah
    for (let i = 0; i < formItems.length; i++) {
      if (!formItems[i].nama_barang || !formItems[i].nama_barang.trim()) {
        alert(`Nama barang pada Baris #${i + 1} tidak boleh kosong! Silakan ketik nama barang.`);
        return;
      }
      if (formItems[i].jumlah <= 0) {
        alert(`Jumlah barang masuk pada Baris #${i + 1} harus lebih dari 0`);
        return;
      }
    }

    let nextBarang = [...barangList];
    const newBarangToPush: Barang[] = [];

    // 1. Resolve setiap item (master barang yang ada atau buat baru dengan stok awal 0)
    const preparedItems = formItems.map(item => {
      const trimmedName = item.nama_barang.trim();
      let matchedB = item.id_barang
        ? nextBarang.find(b => b.id === item.id_barang)
        : nextBarang.find(b => b.nama_barang.toLowerCase() === trimmedName.toLowerCase());

      if (!matchedB) {
        const maxId = nextBarang.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0);
        const nextId = (maxId || 81) + 1;
        const nextKode = `000${String(nextId).padStart(3, '0')}`;
        const katName = item.kategori || 'Alat Tulis Kantor';
        const satName = item.satuan || 'Buah';

        matchedB = {
          id: nextId,
          kode_barang: nextKode,
          nama_barang: trimmedName,
          id_kategori: kategoriOptions.findIndex(k => k === katName) + 1 || 1,
          id_satuan: satuanOptions.findIndex(s => s === satName) + 1 || 1,
          id_lokasi: 1,
          stok: 0, // ponytail: Stok awal barang baru selalu 0, penambahan murni dari barang masuk
          stok_minimum: 0,
          foto_url: null,
          deskripsi: 'Ditambahkan via Transaksi Masuk',
          created_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString().split('T')[0],
          kategori: { id: 1, nama_kategori: katName, deskripsi: null, created_at: '' },
          satuan: { id: 1, nama_satuan: satName, created_at: '' },
          lokasi: { id: 1, nama_lokasi: 'Gudang ATK', deskripsi: null, created_at: '' },
        };
        nextBarang = [matchedB, ...nextBarang];
        newBarangToPush.push(matchedB);
      }

      return {
        id_barang: matchedB.id,
        jumlah: Number(item.jumlah),
        harga_satuan: null,
        keterangan: item.keterangan.trim() || null,
        barang: matchedB,
      };
    });

    let updatedList: TransaksiMasuk[];

    if (editItem) {
      // 1. Revert stok lama
      editItem.items.forEach(oldItem => {
        nextBarang = nextBarang.map(b => {
          if (b.id === oldItem.id_barang) {
            return { ...b, stok: Math.max(0, b.stok - oldItem.jumlah) };
          }
          return b;
        });
      });

      // 2. Tambah stok baru
      preparedItems.forEach(newItem => {
        nextBarang = nextBarang.map(b => {
          if (b.id === newItem.id_barang) {
            return { ...b, stok: b.stok + newItem.jumlah };
          }
          return b;
        });
      });

      // 3. Update transaksi list
      updatedList = transaksiList.map(t => {
        if (t.id === editItem.id) {
          return {
            ...t,
            tanggal: formTanggal,
            sumber: formSumber,
            no_referensi: formNoReferensi.trim() || null,
            keterangan: formKeterangan.trim() || null,
            items: preparedItems,
          };
        }
        return t;
      });

      showToast(`Transaksi ${editItem.no_dokumen} berhasil diperbarui!`, 'success');
    } else {
      // Transaksi baru
      preparedItems.forEach(newItem => {
        nextBarang = nextBarang.map(b => {
          if (b.id === newItem.id_barang) {
            return { ...b, stok: b.stok + newItem.jumlah };
          }
          return b;
        });
      });

      const docNo = generateNextDocNo(formTanggal, transaksiList);
      const newTrx: TransaksiMasuk = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        no_dokumen: docNo,
        tanggal: formTanggal,
        sumber: formSumber,
        no_referensi: formNoReferensi.trim() || null,
        items: preparedItems,
        keterangan: formKeterangan.trim() || `Penerimaan ${formSumber}`,
        created_by: 'admin-001',
        created_at: new Date().toISOString(),
      };
      updatedList = [newTrx, ...transaksiList];
      // Simpan transaksi masuk ke Cloud Database
      pushTransaksiMasuk(newTrx);
      showToast(`Dokumen transaksi masuk ${newTrx.no_dokumen} (${preparedItems.length} item) berhasil dicatat!`, 'success');
    }

    // Daftarkan master barang baru jika ada
    newBarangToPush.forEach(nb => {
      pushBarang(nb);
    });

    // Update stok di Cloud Database
    nextBarang.forEach(b => {
      updateBarangStockRemote(b.id, b.stok);
    });

    setBarangList(nextBarang);
    localStorage.setItem('sipersedia_barang_list', JSON.stringify(nextBarang));
    setTransaksiList(updatedList);
    localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify(updatedList));

    // Bersihkan cache laporan statis agar laporan persediaan langsung sinkron
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sipersedia_laporan_data_')) localStorage.removeItem(k);
      });
    }

    setActiveSearchIdx(null);
    setShowModal(false);
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const targetDoc = deleteCandidate.no_dokumen;

    // Kurangi stok master barang yang pernah ditambahkan oleh dokumen ini
    let nextBarang = [...barangList];
    deleteCandidate.items.forEach(itm => {
      nextBarang = nextBarang.map(b => {
        if (b.id === itm.id_barang) {
          return { ...b, stok: Math.max(0, b.stok - itm.jumlah) };
        }
        return b;
      });
    });
    setBarangList(nextBarang);
    localStorage.setItem('sipersedia_barang_list', JSON.stringify(nextBarang));

    const updated = transaksiList.filter(t => t.id !== deleteCandidate.id);
    setTransaksiList(updated);
    localStorage.setItem('sipersedia_transaksi_masuk', JSON.stringify(updated));
    // Hapus juga di cloud database
    deleteTransaksiMasukRemote(targetDoc);

    // Bersihkan cache laporan statis
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sipersedia_laporan_data_')) localStorage.removeItem(k);
      });
    }

    setDeleteCandidate(null);
    showToast(`Transaksi ${targetDoc} berhasil dihapus & stok disesuaikan.`, 'info');
  };

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
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Transaksi Masuk</h1>
          <p className="text-sm text-dark-400 mt-1">Catat barang masuk dari pembelian atau transfer dari provinsi</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditItem(null); setFormSumber('Pembelian'); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Tambah Transaksi
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bps-green-50 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-bps-green" />
          </div>
          <div>
            <p className="text-xl font-bold text-dark-800">{filtered.length}</p>
            <p className="text-xs text-dark-400">Transaksi Bulan Ini</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bps-blue-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-bps-blue" />
          </div>
          <div>
            <p className="text-xl font-bold text-dark-800">{totalItemsBulanIni}</p>
            <p className="text-xs text-dark-400">Total Item Masuk</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bps-teal-50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-bps-teal" />
          </div>
          <div>
            <p className="text-xl font-bold text-dark-800">
              {totalPembelianBulanIni} Nota / {totalTransferBulanIni} BAST
            </p>
            <p className="text-xs text-dark-400">Penerimaan Bulan Ini</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            placeholder="Cari no dokumen, no BAST, atau nama barang..."
          />
        </div>
      </div>

      {/* Table — per No Dokumen (Master-Detail) */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Dokumen</th>
                <th>Tanggal</th>
                <th>Sumber</th>
                <th>No. Referensi</th>
                <th>Barang</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trx) => (
                <tr key={trx.id}>
                  <td>
                    <span className="font-mono text-xs font-medium text-bps-blue bg-bps-blue-50 px-2 py-1 rounded">
                      {trx.no_dokumen}
                    </span>
                  </td>
                  <td className="text-sm text-dark-500">{formatDateShort(trx.tanggal)}</td>
                  <td>
                    <span className={cn(
                      'badge',
                      trx.sumber === 'Pembelian' && 'bg-bps-blue-50 text-bps-blue-700',
                      trx.sumber === 'Transfer Masuk' && 'bg-bps-green-50 text-bps-green-700',
                    )}>
                      {trx.sumber}
                    </span>
                  </td>
                  <td>
                    <div>
                      <p className="text-xs text-dark-400 font-medium">
                        {trx.sumber === 'Pembelian' ? 'No. Nota' : 'No. BAST'}
                      </p>
                      <p className="text-sm font-semibold text-dark-800">{trx.no_referensi || '-'}</p>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-1">
                      {trx.items.map((item, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-medium text-dark-700">{item.barang?.nama_barang}</span>
                          <span className="text-dark-400 ml-1">
                            ({item.jumlah} {item.barang?.satuan?.nama_satuan})
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="text-xs text-dark-500 max-w-[150px] truncate">{trx.keterangan || '-'}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setShowPrintPreview(trx)}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-dark-700 hover:bg-dark-100 transition-colors"
                        title="Cetak Berita Acara Penerimaan"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(trx)}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-bps-blue hover:bg-bps-blue-50 transition-colors"
                        title="Edit Transaksi"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate(trx)}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ArrowDownToLine className="w-12 h-12 text-dark-200 mx-auto mb-3" />
                    <p className="text-dark-700 font-semibold text-sm">Belum Ada Transaksi Barang Masuk</p>
                    <p className="text-dark-400 text-xs mt-1 max-w-md mx-auto leading-relaxed">
                      Data transaksi telah di-reset bersih. Silakan klik tombol <strong>&quot;Tambah Transaksi&quot;</strong> di atas untuk mencoba mencatat penerimaan barang masuk ke gudang.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-bps-green-50 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-bps-green" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-dark-800">
                    {editItem ? 'Edit Transaksi Masuk' : 'Tambah Transaksi Masuk'}
                  </h2>
                  <p className="text-xs text-dark-400">Penerimaan barang fisik ke gudang persediaan BPS</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">Sumber Barang <span className="text-red-500">*</span></label>
                    <select
                      className="input text-xs"
                      value={formSumber}
                      onChange={(e) => handleSumberChange(e.target.value as SumberBarangMasuk)}
                      required
                    >
                      <option value="Pembelian">Pembelian (Pengadaan Kantor)</option>
                      <option value="Dari Provinsi">Dari Provinsi (BPS Provinsi)</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label text-xs font-semibold text-dark-700">Tanggal Penerimaan <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    {formSumber === 'Pembelian' ? 'Nomor Nota Pembelian' : 'Nomor BAST (Berita Acara Serah Terima)'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-xs font-mono font-medium"
                    placeholder={formSumber === 'Pembelian' ? 'Contoh: NOTA/2026/001' : 'Contoh: BAST/BPS-SUMSEL/128/VIII/2026'}
                    value={formNoReferensi}
                    onChange={(e) => setFormNoReferensi(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-dark-400 mt-1">
                    {formSumber === 'Pembelian' ? 'Nomor nota faktur pembelian barang' : 'Nomor BAST dari BPS Provinsi Sumatera Selatan'}
                  </p>
                </div>

                {/* DAFTAR BARANG MASUK MULTI-ITEM */}
                <div className="space-y-3 pt-2 border-t border-dark-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-dark-800">Daftar Item Barang Masuk</h4>
                      <p className="text-[11px] text-dark-400">Dapat mencatat lebih dari satu barang dalam satu nomor surat/dokumen</p>
                    </div>
                    <button
                      type="button"
                      onClick={addFormItem}
                      className="inline-flex items-center gap-1 text-xs font-bold text-bps-blue hover:text-bps-blue-700 bg-bps-blue-50 hover:bg-bps-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Barang</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {formItems.map((item, idx) => {
                      const selectedB = item.id_barang ? barangList.find(b => b.id === item.id_barang) : null;
                      const currentStock = selectedB ? selectedB.stok : 0;
                      const currentSatuan = selectedB?.satuan?.nama_satuan || item.satuan || 'Buah';
                      const isNewItem = item.is_new || (!selectedB && (item.nama_barang || '').trim().length > 0);

                      const matchingBarang = barangList
                        .filter(b => b.nama_barang.toLowerCase().includes((item.nama_barang || '').toLowerCase().trim()))
                        .slice(0, 8);

                      return (
                        <div key={idx} className="p-3.5 bg-dark-50 rounded-xl border border-dark-100 space-y-2.5 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-dark-800">Barang #{idx + 1}</span>
                            {formItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFormItem(idx)}
                                className="text-red-500 hover:text-red-700 text-xs inline-flex items-center gap-1 font-medium"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>

                          {/* INPUT AUTOCOMPLETE CARI / TAMBAH BARANG */}
                          <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                              <label className="input-label text-[11px] font-semibold text-dark-700 mb-0">
                                Nama Barang <span className="text-red-500">*</span>
                              </label>
                              {selectedB && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Tersedia (Sisa Stok: {selectedB.stok} {currentSatuan})
                                </span>
                              )}
                              {isNewItem && !selectedB && (
                                <span className="text-[10px] bg-bps-blue-50 text-bps-blue-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-bps-blue-200">
                                  ✨ Barang Baru (Stok Awal: 0)
                                </span>
                              )}
                            </div>

                            <div className="relative">
                              <input
                                type="text"
                                className="input text-xs pl-8 pr-8 font-medium"
                                placeholder="Ketik nama barang (contoh: Lakban, Necis, Kertas HVS...)"
                                value={item.nama_barang}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateFormItem(idx, 'nama_barang', val);
                                  const matched = barangList.find(b => b.nama_barang.toLowerCase() === val.toLowerCase().trim());
                                  if (matched) {
                                    updateFormItem(idx, 'id_barang', matched.id);
                                    updateFormItem(idx, 'is_new', false);
                                    updateFormItem(idx, 'satuan', matched.satuan?.nama_satuan || 'Buah');
                                  } else {
                                    updateFormItem(idx, 'id_barang', null);
                                  }
                                  setActiveSearchIdx(idx);
                                }}
                                onFocus={() => setActiveSearchIdx(idx)}
                                required
                              />
                              <Search className="w-3.5 h-3.5 text-dark-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              {item.nama_barang && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateFormItem(idx, 'nama_barang', '');
                                    updateFormItem(idx, 'id_barang', null);
                                    updateFormItem(idx, 'is_new', false);
                                    setActiveSearchIdx(idx);
                                  }}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 p-0.5"
                                  title="Bersihkan / Cari Lain"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Dropdown Autocomplete Live Popup */}
                            {activeSearchIdx === idx && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-dark-200 rounded-xl shadow-2xl z-40 max-h-52 overflow-y-auto">
                                {matchingBarang.length > 0 && (
                                  <div className="p-1.5 border-b border-dark-100 bg-dark-50/70 text-[10px] font-bold text-dark-500 uppercase tracking-wider">
                                    Pilih dari Data Master Barang:
                                  </div>
                                )}
                                {matchingBarang.map(b => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => {
                                      updateFormItem(idx, 'id_barang', b.id);
                                      updateFormItem(idx, 'nama_barang', b.nama_barang);
                                      updateFormItem(idx, 'is_new', false);
                                      updateFormItem(idx, 'satuan', b.satuan?.nama_satuan || 'Buah');
                                      updateFormItem(idx, 'kategori', b.kategori?.nama_kategori || 'Alat Tulis Kantor');
                                      setActiveSearchIdx(null);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-bps-blue-50 transition-colors flex items-center justify-between border-b border-dark-50 last:border-0"
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-dark-800">{b.nama_barang}</div>
                                      <div className="text-[10px] text-dark-400">
                                        Kode: {b.kode_barang} &bull; {b.kategori?.nama_kategori || 'Umum'}
                                      </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-bps-blue bg-bps-blue-50 px-2.5 py-1 rounded-lg border border-bps-blue-100 whitespace-nowrap">
                                      Sisa Stok: {b.stok} {b.satuan?.nama_satuan || 'Buah'}
                                    </span>
                                  </button>
                                ))}

                                {/* Pilihan Daftarkan Barang Baru */}
                                {item.nama_barang.trim().length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateFormItem(idx, 'id_barang', null);
                                      updateFormItem(idx, 'is_new', true);
                                      setActiveSearchIdx(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center gap-2 border-t border-emerald-100"
                                  >
                                    <PlusCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <div>
                                      <div className="text-xs font-bold text-emerald-900">
                                        + Jadikan Barang Baru: &ldquo;{item.nama_barang}&rdquo;
                                      </div>
                                      <div className="text-[10px] text-emerald-700">
                                        Otomatis terdaftar di Master Barang dengan stok awal 0
                                      </div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Jika Barang Baru, Tampilkan Opsi Satuan & Kategori Inline yang Ringkas */}
                          {isNewItem && !selectedB && (
                            <div className="p-2.5 bg-bps-blue-50/50 border border-bps-blue-100 rounded-lg space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-bps-blue-800">
                                <span>Informasi Tambahan Barang Baru</span>
                                <span className="text-[10px] text-bps-blue-600">Stok Awal: 0 (Murni dari barang masuk)</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-dark-600 block mb-0.5">Satuan</label>
                                  <select
                                    className="input text-xs py-1 h-8"
                                    value={item.satuan || 'Buah'}
                                    onChange={(e) => updateFormItem(idx, 'satuan', e.target.value)}
                                  >
                                    {satuanOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-dark-600 block mb-0.5">Kategori</label>
                                  <select
                                    className="input text-xs py-1 h-8"
                                    value={item.kategori || 'Alat Tulis Kantor'}
                                    onChange={(e) => updateFormItem(idx, 'kategori', e.target.value)}
                                  >
                                    {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* JUMLAH BARANG MASUK DENGAN ESTIMASI STOK LANGSUNG */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="input-label text-[11px] font-semibold text-dark-700 mb-0">
                                Jumlah Masuk ({currentSatuan}) <span className="text-red-500">*</span>
                              </label>
                              <span className="text-[11px] text-dark-500">
                                Sisa Stok: <strong className="text-dark-800">{currentStock}</strong> + Masuk: <strong className="text-bps-blue font-bold">{Number(item.jumlah) || 0}</strong> = Estimasi: <strong className="text-emerald-600 font-bold">{currentStock + (Number(item.jumlah) || 0)} {currentSatuan}</strong>
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              className="input text-xs font-bold w-full"
                              value={item.jumlah}
                              onChange={(e) => updateFormItem(idx, 'jumlah', Number(e.target.value))}
                              required
                            />
                          </div>

                          <div>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="Keterangan per item (opsional)"
                              value={item.keterangan}
                              onChange={(e) => updateFormItem(idx, 'keterangan', e.target.value)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">Catatan Dokumen / Keperluan</label>
                  <textarea
                    className="input min-h-[60px] resize-none text-xs"
                    placeholder="Contoh: Pengadaan ATK Triwulan dari Toko Mitra..."
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-dark-100 bg-dark-50 rounded-b-2xl">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Batal
                </button>
                <button type="submit" className="btn-success text-xs inline-flex items-center gap-1.5">
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{editItem ? 'Simpan Perubahan' : 'Catat Barang Masuk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-in-up p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-dark-800">Hapus Transaksi Masuk?</h3>
              <p className="text-xs text-dark-500 mt-1">
                Apakah Anda yakin ingin menghapus dokumen transaksi{' '}
                <strong className="text-dark-800">"{deleteCandidate.no_dokumen}"</strong>?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-2">
                Stok master barang akan otomatis dikurangi kembali sesuai jumlah yang pernah dicatat.
              </p>
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
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex-1 shadow-sm active:scale-95"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Print Preview Modal — per No Surat (Master-Detail) */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-slide-in-up relative">
            {/* Tombol X Close Floating di Pojok Kanan Atas yang Jelas & Mudah Diklik */}
            <button
              type="button"
              onClick={() => setShowPrintPreview(null)}
              className="absolute top-3 right-3 z-30 p-2 bg-dark-100/90 hover:bg-red-50 hover:text-red-600 text-dark-500 rounded-full transition-colors shadow-sm no-print cursor-pointer"
              title="Tutup Preview (Esc)"
              aria-label="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-dark-100 no-print gap-3 sticky top-0 bg-white z-20 pr-14">
              <div>
                <h2 className="text-base font-bold text-dark-800">Preview Cetak — Bukti Penerimaan Barang</h2>
                <p className="text-xs text-dark-400">Dokumen Penerimaan Barang Masuk (Per Nomor Surat)</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-dark-50 border border-dark-200 rounded-lg px-2 py-1 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-dark-400" />
                  <span className="text-dark-500 font-medium">Tgl Cetak:</span>
                  <input
                    type="date"
                    value={tglCetakDokumen}
                    onChange={(e) => setTglCetakDokumen(e.target.value)}
                    className="bg-transparent font-semibold text-dark-800 focus:outline-none cursor-pointer"
                  />
                </div>
                <button onClick={handlePrint} className="btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5 shadow-sm">
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen</span>
                </button>
                <button onClick={() => setShowPrintPreview(null)} className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1 border-dark-300">
                  <X className="w-3.5 h-3.5" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Injeksi Style Cetak: Kunci A4 PORTRAIT untuk Bukti Penerimaan Barang — Bersih Tanpa Header/Footer Browser (1/1) */}
            <style dangerouslySetInnerHTML={{ __html: `
              @page {
                size: A4 portrait;
                margin: 0;
              }
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #print-area {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  padding: 10mm 15mm 10mm 15mm !important;
                  width: 100% !important;
                  display: block !important;
                  box-sizing: border-box !important;
                }
              }
            `}} />

            <div className="p-8 print:p-0 text-black bg-white" id="print-area">
              {/* KOP SURAT RESMI BPS */}
              <KopSurat />

              <h4 className="text-center font-bold text-black mb-5 print:mb-4 text-base print:text-lg uppercase tracking-wider underline underline-offset-4">
                BUKTI PENERIMAAN BARANG
              </h4>

              {/* Metadata Surat Penerimaan — Rapi, Tidak Patah/Wrap & Pas di Kanan Tanpa Terpotong */}
              <div className="flex justify-between items-start text-xs print:text-[11pt] mb-6 print:mb-6 text-black gap-4">
                {/* Sisi Kiri: No. Dokumen & Sumber Barang */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-gray-700 w-32 shrink-0">No. Dokumen</span>
                    <span
                      className="font-semibold whitespace-nowrap"
                      style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all', hyphens: 'none' }}
                    >
                      : {(showPrintPreview.no_dokumen || '').replace(/-/g, '\u2011')}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-700 w-32 shrink-0">Sumber Barang</span>
                    <span
                      className="font-semibold whitespace-nowrap"
                      style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all', hyphens: 'none' }}
                    >
                      : {showPrintPreview.sumber === 'Pembelian' ? 'Pembelian (Pengadaan Kantor)' : 'Transfer Masuk dari BPS Provinsi'}
                    </span>
                  </div>
                </div>

                {/* Sisi Kanan: Tanggal Surat & No. Nota — Titik Dua Sejajar Tegak Lurus & Angka 2026 Utuh */}
                <div className="space-y-2 shrink-0 pr-2 text-left">
                  <div className="flex items-center whitespace-nowrap">
                    <span className="text-gray-700 w-32 shrink-0">Tanggal Surat</span>
                    <span
                      className="font-semibold whitespace-nowrap text-black"
                      style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all', hyphens: 'none' }}
                    >
                      : {formatDate(showPrintPreview.tanggal)}
                    </span>
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="text-gray-700 w-32 shrink-0">
                      {showPrintPreview.sumber === 'Pembelian' ? 'No. Nota' : 'No. BAST'}
                    </span>
                    <span
                      className="font-semibold whitespace-nowrap text-black"
                      style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all', hyphens: 'none' }}
                    >
                      : {showPrintPreview.no_referensi || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabel barang — semua item dalam satu dokumen nomor surat (Proporsi Mengisi A4 Penuh) */}
              <table className="w-full border-collapse border border-black text-xs print:text-[11pt] mb-6 print:mb-6">
                <thead>
                  <tr className="bg-gray-100 text-black font-bold">
                    <th className="border border-black px-2 py-2 print:py-2.5 text-center w-10">No</th>
                    <th className="border border-black px-3 py-2 print:py-2.5 text-left">Nama Barang</th>
                    <th className="border border-black px-3 py-2 print:py-2.5 text-center w-28 print:w-32">Satuan</th>
                    <th className="border border-black px-3 py-2 print:py-2.5 text-center w-24 print:w-28">Jumlah</th>
                    <th className="border border-black px-3 py-2 print:py-2.5 text-left">Keterangan</th>
                  </tr>
                  {/* Baris penomoran (1)-(5): Ramping */}
                  <tr className="bg-gray-50 text-[9px] print:text-[10pt] text-gray-700 font-bold text-center h-4">
                    <th className="border border-black py-0.5 px-1 leading-tight">(1)</th>
                    <th className="border border-black py-0.5 px-1 leading-tight">(2)</th>
                    <th className="border border-black py-0.5 px-1 leading-tight">(3)</th>
                    <th className="border border-black py-0.5 px-1 leading-tight">(4)</th>
                    <th className="border border-black py-0.5 px-1 leading-tight">(5)</th>
                  </tr>
                </thead>
                <tbody>
                  {showPrintPreview.items.map((item, idx) => (
                    <tr key={idx} className="text-black">
                      <td className="border border-black px-2 py-2.5 print:py-3.5 text-center">{idx + 1}</td>
                      <td className="border border-black px-3 py-2.5 print:py-3.5 font-medium">{item.barang?.nama_barang}</td>
                      <td className="border border-black px-3 py-2.5 print:py-3.5 text-center">{item.barang?.satuan?.nama_satuan || 'Buah'}</td>
                      <td className="border border-black px-3 py-2.5 print:py-3.5 text-center font-normal">{item.jumlah}</td>
                      <td className="border border-black px-3 py-2.5 print:py-3.5">{item.keterangan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-xs print:text-[10pt] text-gray-700 mb-3 print:mb-3 italic">
                Catatan: {showPrintPreview.keterangan || '-'}
              </p>

              {/* Tanda Tangan Format Resmi BPS (.signature-block seragam) */}
              <div className="signature-block">
                <div className="sig-col">
                  <p className="sig-title">Yang Menyerahkan,</p>
                  <p>Rekanan / Vendor</p>
                  <div className="sig-space" />
                  <p>
                    <span className="sig-name">
                      (&nbsp;................................&nbsp;)
                    </span>
                  </p>
                </div>
                <div className="sig-col">
                  <p>{formatTanggalTandaTangan(tglCetakDokumen)}</p>
                  <p className="sig-title">Petugas Pengelola Persediaan</p>
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

      {/* Modal Tambah Cepat Barang Baru untuk Kegiatan */}
      {showQuickAddBarang && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-in-up overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-100 bg-bps-blue-50/50">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-bps-blue" />
                <div>
                  <h3 className="text-sm font-bold text-dark-800">Tambah Barang Baru ke Master</h3>
                  <p className="text-[11px] text-dark-400">Barang otomatis terdaftar dengan stok awal 0</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddBarang(false)}
                className="p-1 rounded-lg text-dark-400 hover:bg-dark-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickBarang} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={quickNamaBarang}
                    onChange={(e) => setQuickNamaBarang(e.target.value)}
                    className="input text-xs"
                    placeholder="Contoh: Kertas HVS F4 70gsm, Spidol Snowman..."
                  />
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">Kode Barang</label>
                  <input
                    type="text"
                    value={quickKodeBarang}
                    onChange={(e) => setQuickKodeBarang(e.target.value)}
                    className="input text-xs font-mono"
                    placeholder="Otomatis / custom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">Kategori <span className="text-red-500">*</span></label>
                  <select
                    value={quickKategori}
                    onChange={(e) => setQuickKategori(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    {kategoriOptions.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">Satuan <span className="text-red-500">*</span></label>
                  <select
                    value={quickSatuan}
                    onChange={(e) => setQuickSatuan(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    {satuanOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">Lokasi <span className="text-red-500">*</span></label>
                  <select
                    value={quickLokasi}
                    onChange={(e) => setQuickLokasi(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    {lokasiOptions.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">Deskripsi / Spesifikasi</label>
                <input
                  type="text"
                  value={quickDeskripsi}
                  onChange={(e) => setQuickDeskripsi(e.target.value)}
                  className="input text-xs"
                  placeholder="Keterangan singkat spesifikasi barang..."
                />
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800">
                💡 Barang ini langsung didaftarkan ke master barang lengkap dengan Kategori, Satuan, dan Lokasinya, lalu otomatis terpilih di formulir transaksi masuk Anda.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddBarang(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Pilih</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
