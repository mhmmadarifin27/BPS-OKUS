'use client';

import { useState, useEffect } from 'react';
import { Ruler, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { pushMasterItem, deleteMasterItem, fetchAndSyncMaster } from '@/lib/master-sync';

interface SatuanItem {
  id: number;
  nama: string;
}

const initialSatuan: SatuanItem[] = [
  { id: 1, nama: 'Buah' }, { id: 2, nama: 'Rim' }, { id: 3, nama: 'Lusin' },
  { id: 4, nama: 'Pak' }, { id: 5, nama: 'Dus' }, { id: 6, nama: 'Set' },
  { id: 7, nama: 'Unit' }, { id: 8, nama: 'Lembar' }, { id: 9, nama: 'Roll' },
  { id: 10, nama: 'Botol' }, { id: 11, nama: 'Kotak' }, { id: 12, nama: 'Batang' },
];

export default function SatuanPage() {
  const [satuanList, setSatuanList] = useState<SatuanItem[]>(initialSatuan);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SatuanItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SatuanItem | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user'>('admin');
  const [toast, setToast] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Form State
  const [formNama, setFormNama] = useState('');

  // Load User Role & Satuan from LocalStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('sipersedia_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUserRole(u.role || 'admin');
      } catch (e) {
        console.error(e);
      }
    }

    const storedSat = localStorage.getItem('sipersedia_satuan_list');
    if (storedSat) {
      try {
        const parsed = JSON.parse(storedSat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSatuanList(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    // Initialize storage if empty
    localStorage.setItem('sipersedia_satuan_list', JSON.stringify(initialSatuan));

    // Tarik terbaru dari cloud (mengantre pulih bila halaman terbuka sebelum sinkronisasi layout selesai)
    fetchAndSyncMaster('satuan').then((rows) => {
      if (Array.isArray(rows) && rows.length > 0) setSatuanList(rows);
    });
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditItem(null);
    setFormNama('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: SatuanItem) => {
    setEditItem(item);
    setFormNama(item.nama);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      alert('Nama satuan tidak boleh kosong');
      return;
    }

    let updatedList: SatuanItem[];
    if (editItem) {
      updatedList = satuanList.map((s) =>
        s.id === editItem.id ? { ...s, nama: formNama.trim() } : s
      );
      const changedItem = updatedList.find((s) => s.id === editItem.id);
      if (changedItem) {
        if (changedItem.nama !== editItem.nama) {
          // Nama diganti: singkirkan nama lama di cloud dulu agar tidak dobel
          await deleteMasterItem('satuan', { nama: editItem.nama });
        }
        pushMasterItem('satuan', changedItem);
      }
      showNotification(`Satuan "${formNama.trim()}" berhasil diperbarui!`, 'success');
    } else {
      const newItem: SatuanItem = {
        id: Date.now(),
        nama: formNama.trim(),
      };
      updatedList = [...satuanList, newItem];
      // Sinkronkan ke Supabase agar terlihat di seluruh perangkat
      pushMasterItem('satuan', newItem);
      showNotification(`Satuan "${formNama.trim()}" berhasil ditambahkan!`, 'success');
    }

    setSatuanList(updatedList);
    localStorage.setItem('sipersedia_satuan_list', JSON.stringify(updatedList));
    setShowModal(false);
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const targetName = deleteCandidate.nama;
    const updated = satuanList.filter((s) => s.id !== deleteCandidate.id);
    setSatuanList(updated);
    localStorage.setItem('sipersedia_satuan_list', JSON.stringify(updated));
    // Sinkronkan penghapusan ke Supabase
    deleteMasterItem('satuan', { nama: targetName });
    setDeleteCandidate(null);
    showNotification(`Satuan "${targetName}" berhasil dihapus.`, 'info');
  };

  const filtered = satuanList.filter((s) =>
    s.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-enter space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="font-semibold text-emerald-900">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1.5 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark-800">Satuan Barang</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-dark-100 text-dark-700">
              {userRole === 'admin' ? 'Master Data Admin' : 'Lihat Data'}
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-1">
            Kelola satuan ukuran baku persediaan barang BPS OKU Selatan
          </p>
        </div>
        {userRole === 'admin' && (
          <button onClick={handleOpenAdd} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Satuan
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 text-sm"
            placeholder="Cari nama satuan barang..."
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
      </div>

      {/* Grid Satuan */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-xl bg-dark-50 hover:bg-bps-blue-50/70 border border-transparent hover:border-bps-blue/20 group transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-xs border border-dark-100 group-hover:border-bps-blue/20">
                  <Ruler className="w-3.5 h-3.5 text-dark-400 group-hover:text-bps-blue transition-colors" />
                </div>
                <span className="text-sm font-semibold text-dark-800 truncate">{s.nama}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(s)}
                  className="p-1.5 rounded-lg text-dark-500 hover:text-bps-blue hover:bg-white transition-all shadow-xs"
                  title="Edit Satuan"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteCandidate(s)}
                  className="p-1.5 rounded-lg text-dark-500 hover:text-red-500 hover:bg-white transition-all shadow-xs"
                  title="Hapus Satuan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center">
              <Ruler className="w-10 h-10 text-dark-300 mx-auto mb-2" />
              <p className="text-sm text-dark-500 font-semibold">Tidak ada satuan ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah / Edit Satuan */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-bps-blue-50 flex items-center justify-center">
                  <Ruler className="w-5 h-5 text-bps-blue" />
                </div>
                <h2 className="text-lg font-bold text-dark-800">
                  {editItem ? 'Edit Satuan' : 'Tambah Satuan Baru'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-5">
                <label className="input-label text-xs font-semibold text-dark-700">
                  Nama Satuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="input text-sm"
                  placeholder="Contoh: Buah, Rim, Lusin, Dus, Unit"
                  autoFocus
                />
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
                  {editItem ? 'Simpan Perubahan' : 'Tambah Satuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-in-up p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-dark-800">Hapus Satuan?</h3>
              <p className="text-xs text-dark-500 mt-1">
                Apakah Anda yakin ingin menghapus satuan ukuran{' '}
                <strong className="text-dark-800">"{deleteCandidate.nama}"</strong>?
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
  );
}

