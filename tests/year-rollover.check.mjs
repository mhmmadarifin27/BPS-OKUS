import assert from 'node:assert';

// Self-check for dynamic years and multi-year inventory rollover logic
function getAvailableYears(additionalDates = [], customYears = []) {
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
  const endYear = Math.max(currentYear + 10, 2035, ...dateYears, ...customYears);
  const yearSet = new Set();
  for (let y = startYear; y <= endYear; y++) {
    yearSet.add(y);
  }
  customYears.forEach(y => {
    if (y >= startYear) yearSet.add(y);
  });
  return Array.from(yearSet).sort((a, b) => a - b);
}

// 1. Check dynamic years generation
const years = getAvailableYears();
assert(years.includes(2025), 'Must include 2025');
assert(years.includes(2026), 'Must include 2026');
assert(years.includes(2027), 'Must include 2027');
assert(years.includes(2030), 'Must include 2030');
assert(years.includes(2035), 'Must include 2035');
assert(years[0] === 2025, 'First year is 2025');

// 1b. Check extra future year detection
const futureYears = getAvailableYears(['2038-05-10']);
assert(futureYears.includes(2038), 'Must automatically expand to 2038');

// 1c. Check manual custom year addition
const withCustom = getAvailableYears([], [2042]);
assert(withCustom.includes(2042), 'Must include custom year 2042');

// 2. Check year rollover calculation logic
function calculateStockForYear(selectedYear, targetBarangId, txMasuk, txKeluar) {
  const isMatch = (itm) => itm.id_barang === targetBarangId;
  const getYear = (tgl) => parseInt(tgl.split('-')[0], 10);

  // Kumulatif sebelum selectedYear
  let masukSebelum = 0;
  txMasuk.forEach(t => {
    if (getYear(t.tanggal) < selectedYear) {
      t.items?.forEach(i => { if (isMatch(i)) masukSebelum += i.jumlah; });
    }
  });

  let keluarSebelum = 0;
  txKeluar.forEach(t => {
    if (getYear(t.tanggal) < selectedYear) {
      t.items?.forEach(i => { if (isMatch(i)) keluarSebelum += i.jumlah; });
    }
  });

  const stockAwal = Math.max(0, masukSebelum - keluarSebelum);

  // Mutasi tahun berjalan
  let masukTahun = 0;
  txMasuk.forEach(t => {
    if (getYear(t.tanggal) === selectedYear) {
      t.items?.forEach(i => { if (isMatch(i)) masukTahun += i.jumlah; });
    }
  });

  let keluarTahun = 0;
  txKeluar.forEach(t => {
    if (getYear(t.tanggal) === selectedYear) {
      t.items?.forEach(i => { if (i.jumlah) keluarTahun += i.jumlah; });
    }
  });

  const sisaAkhir = stockAwal + masukTahun - keluarTahun;
  return { stockAwal, masukTahun, keluarTahun, sisaAkhir };
}

const mockMasuk = [
  { tanggal: '2026-08-10', items: [{ id_barang: 1, jumlah: 100 }] }
];
const mockKeluar = [
  { tanggal: '2026-09-15', items: [{ id_barang: 1, jumlah: 20 }] },
  { tanggal: '2027-02-10', items: [{ id_barang: 1, jumlah: 15 }] }
];

// In 2026: stockAwal = 0, masuk = 100, keluar = 20, sisa = 80
const res2026 = calculateStockForYear(2026, 1, mockMasuk, mockKeluar);
assert.strictEqual(res2026.stockAwal, 0);
assert.strictEqual(res2026.masukTahun, 100);
assert.strictEqual(res2026.keluarTahun, 20);
assert.strictEqual(res2026.sisaAkhir, 80);

// In 2027: stockAwal = 80 (carried over!), masuk = 0, keluar = 15, sisa = 65
const res2027 = calculateStockForYear(2027, 1, mockMasuk, mockKeluar);
assert.strictEqual(res2027.stockAwal, 80, '2027 stock awal should be 80');
assert.strictEqual(res2027.masukTahun, 0);
assert.strictEqual(res2027.keluarTahun, 15);
assert.strictEqual(res2027.sisaAkhir, 65);

// In 2028: stockAwal = 65 (carried over!), masuk = 0, keluar = 0, sisa = 65
const res2028 = calculateStockForYear(2028, 1, mockMasuk, mockKeluar);
assert.strictEqual(res2028.stockAwal, 65, '2028 stock awal should be 65');
assert.strictEqual(res2028.sisaAkhir, 65);

console.log('✅ All year-rollover assertions passed successfully.');
