'use client';

import { useState, useEffect } from 'react';
import { Tags, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { pushMasterItem, deleteMasterItem, fetchAndSyncMaster } from '@/lib/master-sync';

interface KategoriItem {
  id: number;
  nama: string;
  deskripsi: string;
  jumlah_barang: number;
}

const initialKategori: KategoriItem[] = [
  { id: 1, nama: 'Alat Tulis Kantor', deskripsi: 'Perlengkapan tulis menulis dan perkantoran', jumlah_barang: 8 },
  { id: 2, nama: 'Peralatan Komputer', deskripsi: 'Perangkat keras dan aksesoris komputer', jumlah_barang: 2 },
  { id: 3, nama: 'Perlengkapan Rumah Tangga', deskripsi: 'Kebutuhan rumah tangga kantor', jumlah_barang: 1 },
  { id: 4, nama: 'Alat Kebersihan', deskripsi: 'Peralatan untuk kebersihan kantor', jumlah_barang: 1 },
  { id: 5, nama: 'Perlengkapan Cetakan', deskripsi: 'Formulir, buku, dan cetakan', jumlah_barang: 1 },
  { id: 6, nama: 'Peralatan Elektronik', deskripsi: 'Perangkat elektronik kantor', jumlah_barang: 0 },
];

export default function KategoriPage() {
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>(initialKategori);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<KategoriItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<KategoriItem | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user'>('admin');
  const [toast, setToast] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');

  // Load User Role & Kategori from LocalStorage
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

    // Tarik terbaru dari cloud (mengatasi race saat halaman terbuka lebih dulu dari sinkronisasi layout)
    fetchAndSyncMaster('kategori').then((rows) => {
      if (Array.isArray(rows) && rows.length > 0) setKategoriList(rows);
    });

    const storedKat = localStorage.getItem('sipersedia_kategori_list');
    if (storedKat) {
      try {
        const parsed = JSON.parse(storedKat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKategoriList(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    // Initialize storage if empty
    localStorage.setItem('sipersedia_kategori_list', JSON.stringify(initialKategori));
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditItem(null);
    setFormNama('');
    setFormDeskripsi('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: KategoriItem) => {
    setEditItem(item);
    setFormNama(item.nama);
    setFormDeskripsi(item.deskripsi || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      alert('Nama kategori tidak boleh kosong');
      return;
    }

    let updatedList: KategoriItem[];
    if (editItem) {
      updatedList = kategoriList.map((k) =>
        k.id === editItem.id
          ? { ...k, nama: formNama.trim(), deskripsi: formDeskripsi.trim() }
          : k
      );
      const changedItem = updatedList.find((k) => k.id === editItem.id);
      if (changedItem) {
        if (changedItem.nama !== editItem.nama) {
          // Nama diganti: singkirkan nama lama di cloud dulu agar tidak dobel
          await deleteMasterItem('kategori', { nama: editItem.nama });
        }
        pushMasterItem('kategori', changedItem);
      }
      showNotification(`Kategori "${formNama.trim()}" berhasil diperbarui!`, 'success');
    } else {
      const newItem: KategoriItem = {
        id: Date.now(),
        nama: formNama.trim(),
        deskripsi: formDeskripsi.trim(),
        jumlah_barang: 0,
      };
      updatedList = [newItem, ...kategoriList];
      // Sinkronkan ke Supabase agar terlihat di seluruh perangkat
      pushMasterItem('kategori', newItem);
      showNotification(`Kategori "${formNama.trim()}" berhasil ditambahkan!`, 'success');
    }

    setKategoriList(updatedList);
    localStorage.setItem('sipersedia_kategori_list', JSON.stringify(updatedList));
    setShowModal(false);
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const targetName = deleteCandidate.nama;
    const updated = kategoriList.filter((k) => k.id !== deleteCandidate.id);
    setKategoriList(updated);
    localStorage.setItem('sipersedia_kategori_list', JSON.stringify(updated));
    // Sinkronkan penghapusan ke Supabase
    deleteMasterItem('kategori', { nama: targetName });
    setDeleteCandidate(null);
    showNotification(`Kategori "${targetName}" berhasil dihapus.`, 'info');
  };

  const filtered = kategoriList.filter(
    (k) =>
      k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.deskripsi.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="text-2xl font-bold text-dark-800">Kategori Barang</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-dark-100 text-dark-700">
              {userRole === 'admin' ? 'Master Data Admin' : 'Lihat Data'}
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-1">
            Kelola kategori klasifikasi persediaan barang BPS OKU Selatan
          </p>
        </div>
        {userRole === 'admin' && (
          <button onClick={handleOpenAdd} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Kategori
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
            placeholder="Cari nama atau deskripsi kategori..."
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

      {/* Grid Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((kat) => (
          <div key={kat.id} className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-bps-blue-50 flex items-center justify-center border border-bps-blue/10">
                  <Tags className="w-5 h-5 text-bps-blue" />
                </div>
                <span className="badge bg-dark-50 text-dark-600 font-semibold">
                  {kat.jumlah_barang} barang
                </span>
              </div>
              <h3 className="font-bold text-dark-800 text-base mb-1">{kat.nama}</h3>
              <p className="text-xs text-dark-500 leading-relaxed min-h-[32px]">{kat.deskripsi || '-'}</p>
            </div>

            <div className="flex items-center gap-2 pt-4 mt-3 border-t border-dark-100">
              <button
                type="button"
                onClick={() => handleOpenEdit(kat)}
                className="flex-1 btn-secondary text-xs py-2 inline-flex items-center justify-center gap-1.5 hover:text-bps-blue hover:border-bps-blue/30 active:scale-95 transition-all"
                title="Edit Kategori"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteCandidate(kat)}
                className="p-2 rounded-lg text-dark-400 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95 border border-transparent hover:border-red-200"
                title="Hapus Kategori"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center card p-8">
            <Tags className="w-12 h-12 text-dark-300 mx-auto mb-3" />
            <h3 className="font-bold text-dark-800 text-base">Tidak ada kategori ditemukan</h3>
            <p className="text-xs text-dark-400 mt-1">Coba sesuaikan kata kunci pencarian atau tambah kategori baru.</p>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Kategori */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-bps-blue-50 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-bps-blue" />
                </div>
                <h2 className="text-lg font-bold text-dark-800">
                  {editItem ? 'Edit Kategori' : 'Tambah Kategori Baru'}
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
              <div className="p-5 space-y-4">
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Nama Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    className="input text-sm"
                    placeholder="Contoh: Alat Tulis Kantor, Kertas, dll"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Deskripsi Kategori (opsional)
                  </label>
                  <textarea
                    value={formDeskripsi}
                    onChange={(e) => setFormDeskripsi(e.target.value)}
                    className="input min-h-[90px] resize-none text-sm"
                    placeholder="Keterangan singkat mengenai kategori barang ini..."
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
                  {editItem ? 'Simpan Perubahan' : 'Tambah Kategori'}
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
              <h3 className="text-base font-bold text-dark-800">Hapus Kategori?</h3>
              <p className="text-xs text-dark-500 mt-1">
                Apakah Anda yakin ingin menghapus kategori{' '}
                <strong className="text-dark-800">"{deleteCandidate.nama}"</strong>?
              </p>
              {deleteCandidate.jumlah_barang > 0 && (
                <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] text-left">
                  ⚠️ Peringatan: Terdapat {deleteCandidate.jumlah_barang} barang yang tercatat pada kategori ini.
                </div>
              )}
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

