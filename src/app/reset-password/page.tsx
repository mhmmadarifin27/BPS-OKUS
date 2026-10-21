import { redirect } from 'next/navigation';

/**
 * Fitur "Lupa Password via Email" telah dinonaktifkan karena akun resmi
 * tidak memakai inbox email nyata. Setiap tautan lama yang masih menunjuk
 * ke halaman ini dialihkan kembali ke halaman login.
 * Pengubahan sandi tetap dapat dilakukan dari aplikasi (menu Pengaturan)
 * atau oleh Admin melalui halaman Manajemen Akun.
 */
export default function ResetPasswordPage() {
  redirect('/login');
}
