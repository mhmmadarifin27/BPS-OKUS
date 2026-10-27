import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function generateDocNumber(prefix: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `${prefix}-${year}/${month}/${random}`;
}

export function getMonthName(month: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[month - 1] || '';
}

export function getStokStatus(stok: number, stokMinimum: number): 'aman' | 'rendah' | 'habis' {
  if (stok <= 0) return 'habis';
  if (stok <= stokMinimum) return 'rendah';
  return 'aman';
}

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function getNamaHari(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return NAMA_HARI[date.getDay()];
}

export function angkaKeTerbilang(num: number): string {
  const dasar = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas'
  ];
  if (num < 12) return dasar[num];
  if (num < 20) return dasar[num - 10] + ' Belas';
  if (num < 100) return dasar[Math.floor(num / 10)] + ' Puluh' + (num % 10 !== 0 ? ' ' + dasar[num % 10] : '');
  if (num < 200) return 'Seratus' + (num % 100 !== 0 ? ' ' + angkaKeTerbilang(num % 100) : '');
  if (num < 1000) return dasar[Math.floor(num / 100)] + ' Ratus' + (num % 100 !== 0 ? ' ' + angkaKeTerbilang(num % 100) : '');
  if (num < 2000) return 'Seribu' + (num % 1000 !== 0 ? ' ' + angkaKeTerbilang(num % 1000) : '');
  if (num < 1000000) return angkaKeTerbilang(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 !== 0 ? ' ' + angkaKeTerbilang(num % 1000) : '');
  return String(num);
}

export function getTeksBeritaAcaraOpname(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const hari = getNamaHari(date);
  const tanggalTerbilang = angkaKeTerbilang(date.getDate());
  const bulan = getMonthName(date.getMonth() + 1);
  const tahunTerbilang = angkaKeTerbilang(date.getFullYear());
  return `Pada hari ini ${hari}, Tanggal ${tanggalTerbilang} Bulan ${bulan} Tahun ${tahunTerbilang}, kami telah melaksanakan opname phisik barang persediaan dengan hasil rincian sebagai berikut :`;
}

export function formatTanggalTandaTangan(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `Muaradua, ${date.getDate()} ${getMonthName(date.getMonth() + 1)} ${date.getFullYear()}`;
}

export function getAvailableYears(additionalDates: string[] = []): number[] {
  const startYear = 2025;
  const currentYear = new Date().getFullYear();
  const dateYears = additionalDates
    .map(d => {
      if (!d) return NaN;
      const clean = d.split('T')[0];
      const p = clean.split('-');
      return p.length >= 1 ? parseInt(p[0], 10) : new Date(d).getFullYear();
    })
    .filter(y => !isNaN(y) && y >= 2000 && y <= 2100);
  const endYear = Math.max(currentYear + 4, 2030, ...dateYears);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

