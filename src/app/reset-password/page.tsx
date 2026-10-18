'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, KeyRound, Sparkles } from 'lucide-react';
import BpsLogo from '@/components/BpsLogo';
import { supabase } from '@/lib/supabase';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const [targetEmail, setTargetEmail] = useState(emailParam);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Tangani token PKCE jika link email membawa parameter ?code=...
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data?.session?.user) {
          setHasSession(true);
          if (data.session.user.email) {
            setTargetEmail(data.session.user.email);
          }
        }
      });
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setHasSession(true);
        if (data.session.user.email) {
          setTargetEmail(data.session.user.email);
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setHasSession(true);
        if (session.user.email) {
          setTargetEmail(session.user.email);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const emailToUpdate = targetEmail.trim().toLowerCase();
    if (!emailToUpdate && !hasSession) {
      setStatusMessage({ type: 'error', message: 'Silakan masukkan alamat email akun yang ingin diatur ulang!' });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMessage({ type: 'error', message: 'Kata sandi baru minimal 6 karakter!' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', message: 'Konfirmasi kata sandi tidak cocok!' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Coba update via Supabase Auth jika sesi reset aktif
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.warn('[Supabase Auth]: Update password via session:', error.message);
        if (hasSession) {
          setStatusMessage({
            type: 'error',
            message: `Gagal memperbarui sandi: ${error.message}`,
          });
          setIsLoading(false);
          return;
        }
      }

      // 2. Simpan juga ke storage lokal agar langsung aktif
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('sipersedia_passwords');
        const passMap = stored ? JSON.parse(stored) : {};
        if (data?.user?.email) {
          passMap[data.user.email.toLowerCase()] = newPassword;
        }
        if (emailToUpdate) {
          passMap[emailToUpdate] = newPassword;
          if (emailToUpdate === 'okusbps@gmail.com') passMap['okusbps'] = newPassword;
          if (emailToUpdate === 'arifinkembar2@gmail.com') passMap['arifinkembar2'] = newPassword;
        }
        localStorage.setItem('sipersedia_passwords', JSON.stringify(passMap));
      }

      setStatusMessage({
        type: 'success',
        message: 'Kata sandi berhasil diperbarui! Anda sekarang dapat masuk dengan sandi baru.',
      });

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        message: err?.message || 'Gagal memperbarui kata sandi. Silakan coba kembali.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-bps-blue/25 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-bps-orange/20 blur-[110px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-fade-in my-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white shadow-2xl mb-4 ring-4 ring-white/20">
            <BpsLogo size={60} />
          </div>
          <h1 className="text-2xl font-extrabold text-white">SIMPAN OKUS</h1>
          <p className="text-white/80 text-xs font-semibold tracking-wider mt-1 uppercase">
            BPS KABUPATEN OGAN KOMERING ULU SELATAN
          </p>
        </div>

        <div className="glass-card rounded-2xl shadow-2xl border border-white/40 overflow-hidden relative backdrop-blur-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-bps-blue via-bps-orange to-bps-green" />

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-bps-blue-50 text-bps-blue flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-dark-800">Atur Kata Sandi Baru</h2>
              <p className="text-dark-400 text-xs mt-1">
                Silakan buat kata sandi baru untuk akun kedinasan Anda
              </p>
            </div>

            {statusMessage && (
              <div
                className={`mb-4 p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-fade-in font-medium ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{statusMessage.message}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Email Akun Terdaftar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    disabled={hasSession}
                    className="input py-2.5 text-sm rounded-xl disabled:bg-slate-100 disabled:text-dark-500"
                    placeholder="Masukkan email akun Anda"
                  />
                </div>
                {hasSession && (
                  <p className="text-[11px] text-emerald-600 mt-1">✓ Sesi pemulihan akun terverifikasi.</p>
                )}
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pl-10 pr-10 py-2.5 text-sm rounded-xl"
                    placeholder="Minimal 6 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-semibold text-dark-700">
                  Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input pl-10 pr-4 py-2.5 text-sm rounded-xl"
                    placeholder="Ulangi kata sandi baru"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-bps-blue via-blue-600 to-bps-orange hover:from-bps-blue-700 hover:to-bps-orange-600 shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <span>Menyimpan Sandi Baru...</span>
                ) : (
                  <>
                    <span>Simpan Kata Sandi Baru</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-bps-blue hover:text-bps-blue-700 inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Halaman Masuk</span>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Memuat...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
