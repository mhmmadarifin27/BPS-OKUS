'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  Ruler,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileBarChart,
  Users,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardList,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  userRole: 'admin' | 'user';
  pendingCount?: number;
}

const navSections = [
  {
    title: 'MENU UTAMA',
    adminOnly: true,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'MASTER DATA',
    adminOnly: true,
    items: [
      { label: 'Data Barang', href: '/barang', icon: Package },
      { label: 'Kategori', href: '/kategori', icon: Tags },
      { label: 'Satuan', href: '/satuan', icon: Ruler },
      { label: 'Lokasi', href: '/lokasi', icon: MapPin },
    ],
  },
  {
    title: 'MENU UTAMA',
    userOnly: true,
    items: [
      { label: 'Beranda', href: '/dashboard', icon: Home },
      { label: 'Katalog & Stok Barang', href: '/barang', icon: Package },
    ],
  },
  {
    title: 'TRANSAKSI PERSEDIAAN',
    adminOnly: true,
    items: [
      { label: 'Barang Masuk', href: '/transaksi-masuk', icon: ArrowDownToLine },
      { label: 'Pengeluaran Barang', href: '/transaksi-keluar', icon: ArrowUpFromLine },
    ],
  },
  {
    title: 'PERMINTAAN ATK',
    userOnly: true,
    items: [
      { label: 'Permintaan Barang', href: '/transaksi-keluar', icon: ArrowUpFromLine },
    ],
  },
  {
    title: 'PENGATURAN & AKUN',
    userOnly: true,
    items: [
      { label: 'Profil & Pengaturan', href: '/pengaturan', icon: Settings },
    ],
  },
  {
    title: 'LAPORAN & KENDALI',
    adminOnly: true,
    items: [
      { label: 'Laporan Persediaan', href: '/laporan', icon: FileBarChart },
      { label: 'Kartu Kendali', href: '/kartu-kendali', icon: ClipboardList },
    ],
  },
  {
    title: 'PENGATURAN',
    adminOnly: true,
    items: [
      { label: 'Manajemen User', href: '/users', icon: Users },
      { label: 'Pengaturan', href: '/pengaturan', icon: Settings },
    ],
  },
];

export default function Sidebar({
  isCollapsed,
  isMobileOpen,
  onToggleCollapse,
  onCloseMobile,
  userRole,
  pendingCount = 0,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 bg-gradient-to-b from-[#003665] via-[#002647] to-[#00172e] shadow-sidebar transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-[72px]' : 'w-[260px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-16 px-3.5 flex-shrink-0',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5 animate-fade-in min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md flex-shrink-0 ring-2 ring-bps-orange/30">
                  <img
                    src="/images/logo-bps.svg"
                    alt="Logo BPS"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs font-black text-white tracking-wider leading-none truncate">SIMPAN OKUS</h1>
                  <p className="text-[7.5px] text-amber-300 font-extrabold mt-1 tracking-tight truncate uppercase">
                    BPS OKU SELATAN
                  </p>
                </div>
              </div>

              {/* Tombol Ciutkan di atas samping logo dan tulisan BPS */}
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-all flex-shrink-0 ml-1.5"
                title="Ciutkan Menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md ring-2 ring-bps-orange/30 hover:ring-white transition-all group relative"
              title="Klik untuk Luaskan Menu"
            >
              <img
                src="/images/logo-bps.svg"
                alt="Logo BPS"
                className="w-full h-full object-contain group-hover:opacity-30 transition-opacity"
              />
              <ChevronRight className="w-5 h-5 text-bps-blue absolute opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-white/60 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BPS Tricolor Ribbon (Biru, Orange, Hijau) */}
        <div className="h-[4px] w-full bg-gradient-to-r from-bps-blue via-bps-orange to-bps-green flex-shrink-0 shadow-sm" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {navSections.map((section, sIdx) => {
            // Filter sections by role
            if (section.adminOnly && userRole !== 'admin') return null;
            if ((section as any).userOnly && userRole !== 'user') return null;

            const visibleItems = section.items.filter(item =>
              !(item as any).adminOnly || userRole === 'admin'
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="mb-2">
                {!isCollapsed && (
                  <p className="px-6 py-2 text-[10px] font-bold text-amber-200/60 tracking-widest uppercase">
                    {section.title}
                  </p>
                )}
                {isCollapsed && sIdx > 0 && (
                  <div className="mx-4 border-t border-white/10 my-2" />
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const showBadge = (item as any).hasBadge && pendingCount > 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 mx-2 rounded-lg transition-all duration-200 text-sm relative',
                        isCollapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-2.5',
                        isActive
                          ? 'bg-gradient-to-r from-white/20 to-white/10 text-white font-bold shadow-sm border-l-4 border-bps-orange'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-bps-orange rounded-r-full shadow-[0_0_8px_#F5821F]" />
                      )}
                      <Icon className={cn('flex-shrink-0', isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]')} />
                      {!isCollapsed && <span>{item.label}</span>}
                      {showBadge && (
                        <span className={cn(
                          'bg-bps-orange text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center',
                          isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                        )}>
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Role indicator */}
        <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
          {!isCollapsed ? (
            <div className={cn(
              'px-3 py-2 rounded-xl text-xs flex items-center justify-between',
              userRole === 'admin'
                ? 'bg-bps-orange/20 border border-bps-orange/40 text-bps-orange-200'
                : 'bg-bps-green/20 border border-bps-green/40 text-bps-green-200'
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full animate-pulse',
                  userRole === 'admin' ? 'bg-bps-orange' : 'bg-bps-green'
                )} />
                <span className="font-bold tracking-wide">
                  {userRole === 'admin' ? 'ADMIN PERSEDIAAN' : 'PEGAWAI BPS'}
                </span>
              </div>
              <span className="text-[10px] opacity-75 font-mono">OKU-S</span>
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <div
                title={userRole === 'admin' ? 'Admin Persediaan' : 'User Pegawai'}
                className={cn(
                  'w-3 h-3 rounded-full',
                  userRole === 'admin' ? 'bg-bps-orange shadow-[0_0_8px_#F5821F]' : 'bg-bps-green shadow-[0_0_8px_#6DBE45]'
                )}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
