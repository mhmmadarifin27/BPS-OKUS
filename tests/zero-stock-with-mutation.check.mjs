import assert from 'node:assert';

// Filter logic check: item with 0 remaining stock but active mutation must be included
function filterActiveReportItems(items) {
  return items.filter((item) =>
    Number(item.saldo_juli || 0) > 0 ||
    Number(item.pembelian || 0) > 0 ||
    Number(item.transfer_masuk || 0) > 0 ||
    Number(item.pengeluaran || 0) > 0 ||
    Number(item.total_persediaan || 0) > 0
  );
}

function filterActiveStockCards(cards) {
  return cards.filter((c) =>
    Number(c.sisaAkhir || 0) > 0 ||
    Number(c.stock_awal_tahun || 0) > 0 ||
    Number(c.totalMasuk || 0) > 0 ||
    Number(c.totalKeluar || 0) > 0 ||
    (c.entries && c.entries.length > 0)
  );
}

// Case 1: Item bought 30, issued 30, remaining 0 (mentor case)
const sampleReportItem = {
  uraian_barang: 'Kertas A4',
  saldo_juli: 0,
  pembelian: 30,
  transfer_masuk: 0,
  pengeluaran: 30,
  total_persediaan: 0,
};

const sampleCard = {
  nama_barang: 'Kertas A4',
  stock_awal_tahun: 0,
  totalMasuk: 30,
  totalKeluar: 30,
  sisaAkhir: 0,
  entries: [{ masuk: 30, keluar: 0 }, { masuk: 0, keluar: 30 }],
};

// Case 2: Inactive item: 0 everywhere
const inactiveReportItem = {
  uraian_barang: 'Barang Kosong',
  saldo_juli: 0,
  pembelian: 0,
  transfer_masuk: 0,
  pengeluaran: 0,
  total_persediaan: 0,
};

const inactiveCard = {
  nama_barang: 'Barang Kosong',
  stock_awal_tahun: 0,
  totalMasuk: 0,
  totalKeluar: 0,
  sisaAkhir: 0,
  entries: [],
};

const filteredReport = filterActiveReportItems([sampleReportItem, inactiveReportItem]);
assert.strictEqual(filteredReport.length, 1, 'Only item with mutation must be retained in report');
assert.strictEqual(filteredReport[0].uraian_barang, 'Kertas A4');

const filteredCards = filterActiveStockCards([sampleCard, inactiveCard]);
assert.strictEqual(filteredCards.length, 1, 'Only card with mutation must be retained in kartu kendali');
assert.strictEqual(filteredCards[0].nama_barang, 'Kertas A4');

console.log('Zero stock with mutation self-check passed!');
