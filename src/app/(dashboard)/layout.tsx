'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { initOrMigrateStore } from '@/lib/data-management';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  bidang: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const loadUser = () => {
      const stored = localStorage.getItem('sipersedia_user');
      if (!stored) {
        router.replace('/login');
        return;
      }
      try {
        const parsed = JSON.parse(stored);
        // Proteksi rute khusus Admin jika pengguna login sebagai Pegawai (User)
        const ADMIN_ONLY_ROUTES = [
          '/users',
          '/transaksi-masuk',
          '/laporan',
          '/kartu-kendali',
          '/kategori',
          '/satuan',
          '/lokasi'
        ];
        if (parsed.role !== 'admin' && ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
          router.replace('/dashboard');
          return;
        }
        // Bersihkan bidang lama 'Tim Statistik Sosial' untuk Pegawai BPS OKU Selatan
        if (parsed.bidang === 'Tim Statistik Sosial' || (!parsed.bidang && parsed.role !== 'admin')) {
          parsed.bidang = '';
          localStorage.setItem('sipersedia_user', JSON.stringify(parsed));
        }
        setUser(parsed);
      } catch {
        router.replace('/login');
        return;
      }
      setIsLoading(false);
    };

    loadUser();

    // Inisialisasi awal / migrasi data bersih untuk pengujian fitur per fitur
    initOrMigrateStore();

    const handleProfileUpdate = () => {
      loadUser();
    };

    // Bersihkan judul 'SIPERSEDIA' saat mencetak dokumen agar header browser tidak memunculkan teks sipersedia
    let savedTitle = '';
    const handleBeforePrint = () => {
      savedTitle = document.title;
      document.title = ' ';
    };
    const handleAfterPrint = () => {
      if (savedTitle) {
        document.title = savedTitle;
      }
    };

    window.addEventListener('storage', handleProfileUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('storage', handleProfileUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/60 via-[#fcfbf9] to-blue-50/50">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white p-2.5 shadow-xl flex items-center justify-center ring-4 ring-bps-orange/20">
            <img src="/images/logo-bps.svg" alt="Logo BPS" className="w-full h-full object-contain animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-extrabold text-bps-blue tracking-wide">SIMPAN OKUS</h3>
            <p className="text-[11px] text-bps-orange font-bold mt-0.5">SISTEM INFORMASI MANAJEMEN PERSEDIAAN</p>
            <p className="text-xs text-dark-400 font-medium">BPS OKU Selatan · Memuat sistem...</p>
          </div>
          <div className="w-36 h-1.5 bg-dark-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full w-full bg-gradient-to-r from-bps-blue via-bps-orange to-bps-green animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-[#fcfbf9] to-emerald-50/30">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        userRole={user.role}
        pendingCount={2}
      />

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300',
          isSidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]',
        )}
      >
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          userName={user.name}
          userRole={user.role}
          userBidang={user.bidang}
        />

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
