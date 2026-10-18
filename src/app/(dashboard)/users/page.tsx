'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Search, Edit2, Trash2, UserCheck, UserX, Shield, User, X,
  Mail, Building2, Camera, CheckCircle2, AlertTriangle, Save, RefreshCw,
  Check, Lock, Upload, KeyRound
} from 'lucide-react';
import { mockUsers } from '@/lib/mock-data';
import type { User as UserType, UserRole } from '@/types';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<UserType | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCandidate, setResetCandidate] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    nip: '',
    email: '',
    role: 'user' as UserRole,
    bidang: 'Tim Statistik Sosial',
    is_active: true,
    avatar_url: null as string | null,
    password: '',
  });

  // Load users from localStorage or fallback to mockUsers
  useEffect(() => {
    const saved = localStorage.getItem('sipersedia_users_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setIsLoaded(true);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setUsers(mockUsers);
    localStorage.setItem('sipersedia_users_list', JSON.stringify(mockUsers));
    setIsLoaded(true);
  }, []);

  const saveUsersList = (newUsers: UserType[]) => {
    setUsers(newUsers);
    localStorage.setItem('sipersedia_users_list', JSON.stringify(newUsers));
  };

  const handleOpenAdd = () => {
    setEditUser(null);
    setFormData({
      name: '',
      nip: '',
      email: '',
      role: 'user',
      bidang: 'Tim Statistik Sosial',
      is_active: true,
      avatar_url: null,
      password: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user: UserType) => {
    setEditUser(user);
    setFormData({
      name: user.name,
      nip: user.nip || '',
      email: user.email,
      role: user.role,
      bidang: user.bidang,
      is_active: user.is_active,
      avatar_url: user.avatar_url,
      password: '',
    });
    setShowModal(true);
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setNotification({ type: 'error', message: 'Ukuran foto maksimal 3MB!' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFormData(prev => ({ ...prev, avatar_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, avatar_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save User (Create or Update)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotification({ type: 'error', message: 'Nama lengkap wajib diisi!' });
      return;
    }
    if (!formData.email.trim()) {
      setNotification({ type: 'error', message: 'Email kedinasan wajib diisi!' });
      return;
    }

    if (editUser) {
      // UPDATE USER
      const updatedList = users.map(u => {
        if (u.id === editUser.id) {
          return {
            ...u,
            name: formData.name.trim(),
            nip: formData.nip.trim(),
            email: formData.email.trim(),
            role: formData.role,
            bidang: formData.bidang,
            is_active: formData.is_active,
            avatar_url: formData.avatar_url,
          };
        }
        return u;
      });

      saveUsersList(updatedList);

      // Sinkronisasi jika yang diedit adalah akun yang sedang login saat ini
      const currentStored = localStorage.getItem('sipersedia_user');
      if (currentStored) {
        try {
          const cu = JSON.parse(currentStored);
          if (cu.id === editUser.id) {
            const updatedCurrent = {
              ...cu,
              name: formData.name.trim(),
              nip: formData.nip.trim(),
              email: formData.email.trim(),
              role: formData.role,
              bidang: formData.bidang,
              avatar_url: formData.avatar_url,
            };
            localStorage.setItem('sipersedia_user', JSON.stringify(updatedCurrent));
            window.dispatchEvent(new CustomEvent('profileUpdated', { detail: updatedCurrent }));
            window.dispatchEvent(new Event('storage'));
          }
        } catch {}
      }

      setNotification({
        type: 'success',
        message: `Data pengguna "${formData.name.trim()}" dengan role [${formData.role === 'admin' ? 'Administrator' : 'Pegawai'}] berhasil diperbarui!`,
      });
    } else {
      // CREATE NEW USER
      const newUser: UserType = {
        id: `usr-${Date.now()}`,
        name: formData.name.trim(),
        nip: formData.nip.trim() || `199${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
        email: formData.email.trim(),
        role: formData.role,
        bidang: formData.bidang,
        avatar_url: formData.avatar_url,
        is_active: formData.is_active,
        created_at: new Date().toISOString().split('T')[0],
      };

      saveUsersList([newUser, ...users]);
      setNotification({
        type: 'success',
        message: `Pengguna baru "${newUser.name}" dengan role [${newUser.role === 'admin' ? 'Administrator' : 'Pegawai'}] berhasil ditambahkan!`,
      });
    }

    setShowModal(false);
    setTimeout(() => setNotification(null), 5000);
  };

  // Quick Toggle Active
  const handleToggleActive = (user: UserType) => {
    const updatedList = users.map(u => {
      if (u.id === user.id) {
        return { ...u, is_active: !u.is_active };
      }
      return u;
    });
    saveUsersList(updatedList);
    setNotification({
      type: 'success',
      message: `Status pengguna ${user.name} diubah menjadi ${!user.is_active ? 'Aktif' : 'Nonaktif'}.`,
    });
    setTimeout(() => setNotification(null), 3000);
  };

  // Delete User
  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const updatedList = users.filter(u => u.id !== deleteCandidate.id);
    saveUsersList(updatedList);
    setNotification({
      type: 'success',
      message: `Pengguna "${deleteCandidate.name}" berhasil dihapus dari sistem.`,
    });
    setDeleteCandidate(null);
    setTimeout(() => setNotification(null), 4000);
  };

  // Reset Password User
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCandidate) return;
    if (newPassword.length < 6) {
      setNotification({ type: 'error', message: 'Kata sandi baru minimal 6 karakter!' });
      return;
    }
    const existingPass = localStorage.getItem('sipersedia_passwords');
    const passObj = existingPass ? JSON.parse(existingPass) : {};
    if (resetCandidate.email) {
      const em = resetCandidate.email.toLowerCase();
      passObj[em] = newPassword;
      if (em === 'okusbps@gmail.com') passObj['okusbps'] = newPassword;
      if (em === 'arifinkembar2@gmail.com') passObj['arifinkembar2'] = newPassword;
    }
    localStorage.setItem('sipersedia_passwords', JSON.stringify(passObj));

    setNotification({
      type: 'success',
      message: `Kata sandi untuk pengguna "${resetCandidate.name}" (${resetCandidate.email}) berhasil diperbarui!`,
    });
    setShowResetModal(false);
    setResetCandidate(null);
    setNewPassword('');
    setTimeout(() => setNotification(null), 4500);
  };

  // Filtered list
  const filtered = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bidang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.nip && u.nip.includes(searchQuery));

    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.is_active) ||
      (filterStatus === 'inactive' && !u.is_active);

    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userRoleCount = users.filter(u => u.role === 'user').length;

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Manajemen User</h1>
          <p className="text-sm text-dark-400 mt-1">
            Kelola hak akses pengguna, role (Administrator / Pegawai), unit kerja, dan foto profil
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Tambah User Baru</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={cn(
            'flex items-center justify-between p-4 rounded-2xl text-sm shadow-sm animate-fade-in border',
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          )}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className="font-semibold">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-bps-blue-50 flex items-center justify-center text-bps-blue">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-dark-800">{users.length}</p>
            <p className="text-xs text-dark-400 font-medium">Total Pengguna</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-bps-orange-50 flex items-center justify-center text-bps-orange">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-bps-orange">{adminCount}</p>
            <p className="text-xs text-dark-400 font-medium">Administrator</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-bps-blue-50/70 flex items-center justify-center text-bps-blue-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-bps-blue-700">{userRoleCount}</p>
            <p className="text-xs text-dark-400 font-medium">Pegawai (User)</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600">{activeCount}</p>
            <p className="text-xs text-dark-400 font-medium">Pengguna Aktif</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 text-xs"
              placeholder="Cari berdasarkan nama, NIP, email, atau bidang/tim..."
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Filter Role */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="input text-xs w-full md:w-44"
            >
              <option value="all">Semua Role</option>
              <option value="admin">Administrator</option>
              <option value="user">Pegawai (User)</option>
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input text-xs w-full md:w-36"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* User cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((u) => {
          const initials = u.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={u.id}
              className={cn(
                'card p-5 transition-all duration-200 hover:shadow-md flex flex-col justify-between',
                !u.is_active && 'opacity-65 bg-dark-50/50'
              )}
            >
              <div>
                {/* Header Card: Avatar, Name, Role Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-xs overflow-hidden flex-shrink-0 ring-2 ring-white',
                        u.role === 'admin'
                          ? 'bg-gradient-to-br from-bps-blue via-bps-blue-600 to-bps-orange'
                          : 'bg-gradient-to-br from-bps-blue via-bps-teal to-bps-green'
                      )}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-800 text-sm leading-snug">{u.name}</h3>
                      <p className="text-xs text-dark-400 mt-0.5 truncate max-w-[180px]">{u.email}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'badge text-[10px] font-bold px-2 py-0.5 whitespace-nowrap',
                      u.role === 'admin'
                        ? 'bg-bps-orange-50 text-bps-orange border border-bps-orange/20'
                        : 'bg-bps-blue-50 text-bps-blue-700 border border-bps-blue/20'
                    )}
                  >
                    {u.role === 'admin' ? '🛡️ Admin' : '👤 Pegawai'}
                  </span>
                </div>

                {/* Info Fields */}
                <div className="space-y-2 mb-4 bg-dark-50/60 p-3 rounded-xl text-xs">
                  <div className="flex items-center justify-between text-dark-600">
                    <span className="text-dark-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-dark-400" />
                      Unit / Tim:
                    </span>
                    <span className="font-semibold text-dark-800 text-right">{u.bidang}</span>
                  </div>

                  <div className="flex items-center justify-between text-dark-600">
                    <span className="text-dark-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-dark-400" />
                      NIP:
                    </span>
                    <span className="font-mono font-medium text-dark-700 text-right">
                      {u.nip || '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-dark-100/60">
                    <span className="text-dark-400">Status Akun:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      className={cn(
                        'badge text-[10px] font-bold px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity',
                        u.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-dark-100 text-dark-500 border border-dark-200'
                      )}
                      title="Klik untuk mengubah status aktif/nonaktif"
                    >
                      {u.is_active ? '● Aktif' : '○ Nonaktif'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-dark-100">
                <button
                  onClick={() => handleOpenEdit(u)}
                  className="flex-1 btn-secondary text-xs py-2 inline-flex items-center justify-center gap-1.5 font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5 text-bps-blue" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setResetCandidate(u);
                    setNewPassword('');
                    setShowResetModal(true);
                  }}
                  className="px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 inline-flex items-center gap-1 transition-colors"
                  title="Reset Kata Sandi Akun"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reset Sandi</span>
                </button>
                <button
                  onClick={() => setDeleteCandidate(u)}
                  className="p-2 rounded-xl text-dark-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-colors"
                  title="Hapus Pengguna"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-dark-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-dark-700">Tidak ada pengguna ditemukan</h3>
          <p className="text-xs text-dark-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter Anda.</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TAMBAH / EDIT USER DENGAN ROLE & FOTO PROFIL UPLOAD */}
      {/* ======================================================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
            <div className="flex items-center justify-between p-5 border-b border-dark-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bps-blue-50 flex items-center justify-center text-bps-blue">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-dark-800">
                    {editUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
                  </h2>
                  <p className="text-[11px] text-dark-400">
                    {editUser ? `ID: ${editUser.id}` : 'Tambahkan akun administrator atau pegawai BPS'}
                  </p>
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

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              {/* AREA UPLOAD FOTO PROFIL */}
              <div className="p-4 bg-dark-50 rounded-2xl border border-dark-100 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      'w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm overflow-hidden ring-4 ring-white',
                      formData.role === 'admin'
                        ? 'bg-gradient-to-br from-bps-blue via-bps-blue-600 to-bps-orange'
                        : 'bg-gradient-to-br from-bps-blue via-bps-teal to-bps-green'
                    )}
                  >
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt="Preview Foto"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {formData.name
                          ? formData.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          : 'BP'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-bps-blue text-white flex items-center justify-center shadow-md hover:bg-bps-blue-600 transition-colors"
                    title="Pilih Foto dari Komputer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-dark-800">Foto Profil Pengguna</span>
                  </div>
                  <p className="text-[11px] text-dark-400">
                    Format PNG, JPG, atau WebP (Maksimal 3MB)
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-dark-200 text-dark-700 hover:bg-dark-50 inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Upload className="w-3 h-3 text-bps-blue" />
                      <span>{formData.avatar_url ? 'Ganti Foto' : 'Unggah Foto'}</span>
                    </button>
                    {formData.avatar_url && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Input Data */}
              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Nama Lengkap Pegawai <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input text-xs"
                  placeholder="Contoh: Ahmad Fauzi, S.Tr.Stat."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    NIP (18 Digit)
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-mono"
                    placeholder="Contoh: 199112052012011002"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Email Kedinasan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="input text-xs"
                    placeholder="nama@bps-okus.go.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* ROLE & BIDANG / TIM (BISA DI-EDIT SEPENUHNYA) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-bps-blue-50/40 rounded-xl border border-bps-blue/15">
                <div>
                  <label className="input-label text-xs font-bold text-dark-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-bps-blue" />
                    Role / Hak Akses <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input text-xs bg-white font-semibold"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <option value="admin">Administrator (Admin Gudang)</option>
                    <option value="user">Pegawai BPS (User Biasa)</option>
                  </select>
                  <p className="text-[10px] text-dark-400 mt-1">
                    {formData.role === 'admin'
                      ? '✓ Akses seluruh fitur inventaris, barang masuk/keluar, dan laporan.'
                      : '✓ Akses katalog dan permohonan pengambilan ATK (SPB).'}
                  </p>
                </div>

                <div>
                  <label className="input-label text-xs font-bold text-dark-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-bps-blue" />
                    Bidang / Tim Kerja <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input text-xs bg-white"
                    value={formData.bidang}
                    onChange={(e) => setFormData({ ...formData, bidang: e.target.value })}
                  >
                    <option value="Subbagian Umum">Subbagian Umum</option>
                    <option value="Tim Statistik Sosial">Tim Statistik Sosial</option>
                    <option value="Tim Statistik Distribusi">Tim Statistik Distribusi</option>
                    <option value="Tim Pertanian & Kehutanan">Tim Pertanian &amp; Kehutanan</option>
                    <option value="Tim IPDS">Tim IPDS</option>
                    <option value="Tim Neraca (Nerwilis)">Tim Neraca (Nerwilis)</option>
                    <option value="Tim PEK dan KTIP">Tim PEK dan KTIP</option>
                    <option value="Kepala">Kepala BPS</option>
                  </select>
                  <p className="text-[10px] text-dark-400 mt-1">
                    Menentukan unit pemohon persediaan pada dokumen SPB.
                  </p>
                </div>
              </div>

              {!editUser && (
                <div>
                  <label className="input-label text-xs font-semibold text-dark-700">
                    Password Akun Baru (Opsional)
                  </label>
                  <input
                    type="password"
                    className="input text-xs"
                    placeholder="Minimal 6 karakter (Default: bps1608)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-dark-100 bg-dark-50">
                <div>
                  <p className="text-xs font-bold text-dark-800">Status Akun Pengguna</p>
                  <p className="text-[11px] text-dark-400">
                    {formData.is_active
                      ? 'Akun aktif dan diizinkan login ke sistem SIMPAN OKUS.'
                      : 'Akun dinonaktifkan sementara dan tidak dapat login.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <div className="w-10 h-5 bg-dark-300 peer-focus:ring-2 peer-focus:ring-bps-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-dark-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI HAPUS USER                              */}
      {/* ======================================================== */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in-up">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-dark-800">Hapus Pengguna</h3>
                <p className="text-xs text-dark-400">Konfirmasi tindakan penghapusan akun</p>
              </div>
            </div>

            <p className="text-xs text-dark-600 mb-4 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pengguna{' '}
              <strong className="text-dark-800">{deleteCandidate.name}</strong> ({deleteCandidate.email})?
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="p-3 bg-dark-50 rounded-xl text-xs space-y-1 mb-5">
              <div className="flex justify-between text-dark-500">
                <span>Role:</span>
                <span className="font-semibold text-dark-700">
                  {deleteCandidate.role === 'admin' ? 'Administrator' : 'Pegawai'}
                </span>
              </div>
              <div className="flex justify-between text-dark-500">
                <span>Unit / Tim:</span>
                <span className="font-semibold text-dark-700">{deleteCandidate.bidang}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Pengguna</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESET KATA SANDI PENGGUNA                         */}
      {/* ======================================================== */}
      {showResetModal && resetCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in-up">
            <div className="flex items-center justify-between pb-3 border-b border-dark-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-dark-800">Reset Kata Sandi</h3>
                  <p className="text-xs text-dark-400">Atur ulang password untuk akun pengguna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetCandidate(null);
                }}
                className="p-1 rounded-lg text-dark-400 hover:bg-dark-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-dark-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-dark-400">Nama Pengguna:</span>
                  <span className="font-semibold text-dark-800">{resetCandidate.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Email:</span>
                  <span className="font-mono text-dark-700">{resetCandidate.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Unit / Tim Permintaan:</span>
                  <span className="font-semibold text-bps-blue">{resetCandidate.bidang}</span>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Masukkan minimal 6 karakter (cth: pegawai123)"
                  className="input text-xs"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-[11px] text-dark-400 mt-1">
                  Pengguna dapat langsung masuk dengan kata sandi baru ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetCandidate(null);
                  }}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Sandi Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
