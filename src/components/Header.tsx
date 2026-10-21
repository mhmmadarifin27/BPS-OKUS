'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Menu,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  User,
  Settings,
  AlertTriangle,
  Users,
  Shield,
  Save,
  X,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Camera,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  userName: string;
  userRole: string;
  userBidang: string;
}

export default function Header({
  onToggleMobileSidebar,
  userName,
  userRole,
  userBidang,
}: HeaderProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  // Editable profile modal state
  const headerPhotoInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    name: userName,
    nip: '',
    email: '',
    bidang: userBidang,
    avatar_url: null as string | null,
  });

  const profileRef = useRef<HTMLDivElement>(null);

  // Load current user details from localStorage
  const loadUserDetails = () => {
    const stored = localStorage.getItem('sipersedia_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        const resolvedBidang = (u.bidang === 'Tim Statistik Sosial' || (!u.bidang && u.role !== 'admin')) ? '' : (u.bidang || '');
        setEditForm({
          name: u.name || userName,
          nip: u.nip || (u.role === 'admin' ? '199003142010011001' : '199505122018011001'),
          email: u.email || (u.role === 'admin' ? 'guspitak-pppk@bps.go.id' : 'bps1608@bps.go.id'),
          bidang: resolvedBidang,
          avatar_url: u.avatar_url || null,
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    loadUserDetails();
    window.addEventListener('profileUpdated', loadUserDetails);
    return () => window.removeEventListener('profileUpdated', loadUserDetails);
  }, [userName, userBidang]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sipersedia_user');
    router.push('/login');
  };

  const handleSaveModalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = localStorage.getItem('sipersedia_user');
    let u: any = {};
    if (stored) {
      try {
        u = JSON.parse(stored);
      } catch {}
    }

    const updated = {
      ...u,
      name: editForm.name.trim(),
      nip: editForm.nip.trim(),
      email: editForm.email.trim(),
      bidang: editForm.bidang.trim(),
      avatar_url: editForm.avatar_url || null,
    };

    localStorage.setItem('sipersedia_user', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('profileUpdated', { detail: updated }));
    window.dispatchEvent(new Event('storage'));

    setProfileSuccessMsg('Profil akun berhasil diperbarui!');
    setTimeout(() => {
      setProfileSuccessMsg('');
      setIsProfileModalOpen(false);
    }, 1500);
  };


  const notifications = [
    { id: 1, type: 'warning', message: 'Stok Toner Printer HP tinggal 2 unit', time: '5 menit lalu' },
    { id: 2, type: 'warning', message: 'Stok Kertas A4 tinggal 9 rim', time: '1 jam lalu' },
    { id: 3, type: 'info', message: 'Permintaan barang dari Tim Statistik Sosial', time: '2 jam lalu' },
  ];

  return (
    <>
      {/* Top BPS Tricolor Ribbon */}
      <div className="h-[3px] w-full bg-gradient-to-r from-bps-blue via-bps-orange to-bps-green sticky top-0 z-30 flex-shrink-0 shadow-xs print:hidden no-print" />
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-amber-100/70 flex items-center justify-between px-4 lg:px-6 sticky top-[3px] z-30 shadow-xs print:hidden no-print">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-lg text-dark-500 hover:bg-amber-50 hover:text-dark-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile BPS Logo Display */}
          <div className="lg:hidden flex items-center gap-2">
            <img src="/images/logo-bps.svg" alt="Logo BPS" className="w-7 h-7 object-contain" />
            <span className="font-extrabold text-sm text-bps-blue">SIMPAN OKUS</span>
          </div>

          {/* Desktop Institution Badge */}
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50/70 to-blue-50/50 border border-amber-200/60 shadow-2xs">
            <img src="/images/logo-bps.svg" alt="Logo BPS" className="w-5 h-5 object-contain" />
            <div className="text-xs">
              <span className="font-extrabold text-dark-800 tracking-wide">BPS OKU SELATAN</span>
              <span className="text-dark-400 mx-1.5">·</span>
              <span className="text-bps-blue-700 font-semibold">Sistem Persediaan</span>
            </div>
          </div>

          {/* Search Bar Fungsional */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (headerSearchQuery.trim()) {
                router.push(`/barang?search=${encodeURIComponent(headerSearchQuery.trim())}`);
              }
            }}
            className="hidden sm:flex items-center gap-2 bg-white/90 rounded-xl px-3 py-2 w-64 md:w-80 border border-amber-200/60 focus-within:border-bps-orange focus-within:ring-2 focus-within:ring-bps-orange/20 shadow-2xs transition-all relative"
          >
            <Search className="w-4 h-4 text-dark-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cari barang atau cek sisa stok..."
              value={headerSearchQuery}
              onChange={(e) => setHeaderSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-dark-800 placeholder:text-dark-400 focus:outline-none w-full font-medium"
            />
            {headerSearchQuery && (
              <button
                type="button"
                onClick={() => setHeaderSearchQuery('')}
                className="text-dark-400 hover:text-dark-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Role Pill Badge (Indikator Status Akun) */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold shadow-xs select-none text-white",
              userRole === 'admin'
                ? "bg-gradient-to-r from-bps-orange to-amber-500 border border-amber-400/50 shadow-orange-500/20"
                : "bg-gradient-to-r from-bps-green to-emerald-600 border border-emerald-400/50 shadow-emerald-500/20"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>{userRole === 'admin' ? 'ADMINISTRATOR' : 'PEGAWAI BPS'}</span>
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-dark-50 transition-colors border border-transparent hover:border-dark-100"
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden ring-1 ring-black/5",
                userRole === 'admin'
                  ? "bg-gradient-to-br from-bps-blue via-bps-blue-600 to-bps-orange"
                  : "bg-gradient-to-br from-bps-blue via-bps-teal to-bps-green"
              )}>
                {editForm.avatar_url ? (
                  <img src={editForm.avatar_url} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  userName.split(' ').map(n => n[0]).join('').slice(0, 2)
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-dark-800 leading-none">{userName}</p>
                {userBidang && userBidang !== 'Tim Statistik Sosial' && (
                  <p className="text-[11px] text-dark-400 mt-0.5">{userBidang}</p>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-dark-400 hidden md:block" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-dark-100 overflow-hidden animate-fade-in z-50">
                <div className="p-4 border-b border-dark-100 bg-gradient-to-br from-dark-50 to-white">
                  <p className="font-bold text-sm text-dark-800">{userName}</p>
                  {userBidang && userBidang !== 'Tim Statistik Sosial' && (
                    <p className="text-xs text-dark-500 mt-0.5">{userBidang}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={cn(
                      "badge text-[10px] font-bold px-2 py-0.5",
                      userRole === 'admin'
                        ? "bg-bps-orange-100 text-bps-orange-700"
                        : "bg-bps-green-100 text-bps-green-700"
                    )}>
                      {userRole === 'admin' ? '🛡️ Administrator' : '👤 Pegawai BPS'}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5">
                  {/* Tombol Profil Akun Langsung Buka Modal */}
                  <button
                    onClick={() => {
                      loadUserDetails();
                      setIsProfileOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-dark-700 hover:bg-dark-50 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-bps-blue" />
                    <span>Profil Akun</span>
                  </button>

                  {/* Tombol Pengaturan Sistem */}
                  <Link
                    href="/pengaturan?tab=sistem"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-dark-700 hover:bg-dark-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-dark-400" />
                    <span>Pengaturan</span>
                  </Link>

                  {/* Tombol Daftar Tim & PJ (Hanya untuk Administrator, tidak muncul pada role User/Pegawai) */}
                  {userRole === 'admin' && (
                    <Link
                      href="/pengaturan?tab=tim"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-dark-700 hover:bg-dark-50 transition-colors"
                    >
                      <Users className="w-4 h-4 text-dark-400" />
                      <span>Daftar Tim &amp; PJ</span>
                    </Link>
                  )}
                </div>

                <div className="p-1.5 border-t border-dark-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar dari Sistem
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL PROFIL AKUN (Interaktif untuk Admin & Pegawai) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-in-up overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 bg-gradient-to-r from-dark-50 to-white">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden ring-2 ring-white",
                    userRole === 'admin'
                      ? "bg-gradient-to-br from-bps-blue via-bps-blue-600 to-bps-orange"
                      : "bg-gradient-to-br from-bps-blue via-bps-teal to-bps-green"
                  )}>
                    {editForm.avatar_url ? (
                      <img src={editForm.avatar_url} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      userName.split(' ').map(n => n[0]).join('').slice(0, 2)
                    )}
                  </div>
                  <input
                    type="file"
                    ref={headerPhotoInputRef}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setEditForm(prev => ({ ...prev, avatar_url: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => headerPhotoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-bps-blue text-white flex items-center justify-center shadow-xs hover:bg-bps-blue-600"
                    title="Upload Foto"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-dark-800">{userName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => headerPhotoInputRef.current?.click()}
                      className="text-[11px] text-bps-blue hover:underline font-semibold"
                    >
                      {editForm.avatar_url ? 'Ganti Foto' : 'Unggah Foto'}
                    </button>
                    {editForm.avatar_url && (
                      <>
                        <span className="text-dark-300">·</span>
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, avatar_url: null }))}
                          className="text-[11px] text-red-500 hover:underline font-semibold"
                        >
                          Hapus Foto
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileSuccessMsg && (
              <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold">{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveModalProfile} className="p-5 space-y-4">
              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input text-xs"
                  placeholder="Nama Lengkap"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    NIP Pegawai
                  </label>
                  <input
                    type="text"
                    value={editForm.nip}
                    onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                    className="input text-xs font-mono"
                    placeholder="18 Digit NIP"
                  />
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Role Akun
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={userRole === 'admin' ? 'Administrator' : 'Pegawai'}
                    className="input text-xs bg-dark-50 text-dark-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Email Kedinasan
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input text-xs"
                  placeholder="email@bps.go.id"
                />
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Unit Kerja / Tim
                </label>
                <input
                  type="text"
                  value={editForm.bidang}
                  onChange={(e) => setEditForm({ ...editForm, bidang: e.target.value })}
                  className="input text-xs"
                  placeholder="Contoh: Subbagian Umum / Tim Sosial"
                />
              </div>

              <div className="pt-2 border-t border-dark-100 flex items-center justify-between gap-2">
                <Link
                  href="/pengaturan?tab=profil"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-xs text-bps-blue hover:underline font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pengaturan Lengkap</span>
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
