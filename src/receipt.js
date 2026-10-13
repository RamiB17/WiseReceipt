export const CATEGORIES = ['Groceries', 'Eating out', 'Transport', 'Shopping', 'Health', 'Other'];

const MERCHANTS = [
  { name: "McDonald's", category: 'Eating out', terms: [/mcdonald/i, /mc\s*donald/i, /mcdonalds/i] },
  { name: 'Tim Hortons', category: 'Eating out', terms: [/tim\s*horton/i] },
  { name: 'Starbucks', category: 'Eating out', terms: [/starbucks/i] },
  { name: 'Subway', category: 'Eating out', terms: [/subway/i] },
  { name: 'Walmart', category: 'Groceries', terms: [/wal\s*mart/i, /walmart/i] },
  { name: 'Costco', category: 'Groceries', terms: [/costco/i] },
  { name: 'Loblaws', category: 'Groceries', terms: [/loblaws/i] },
  { name: 'Metro', category: 'Groceries', terms: [/^metro\b/i] },
  { name: 'FreshCo', category: 'Groceries', terms: [/fresh\s*co/i] },
  { name: 'Shoppers Drug Mart', category: 'Health', terms: [/shoppers\s*drug\s*mart/i] },
  { name: 'Rexall', category: 'Health', terms: [/rexall/i] },
  { name: 'OC Transpo', category: 'Transport', terms: [/oc\s*transpo/i] },
  { name: 'Uber', category: 'Transport', terms: [/^uber\b/i] },
  { name: 'IKEA', category: 'Shopping', terms: [/ikea/i] }
];

export function categoryForStore(store) {
  return MERCHANTS.find(merchant => merchant.terms.some(term => term.test(store)))?.category ?? 'Other';
}

export function parseMoney(value) {
  const cleaned = String(value).replace(/[^\d.,]/g, '');
  // Accept 1,234.56, 1.234,56 and 12,34 from different receipt formats.
  const dot = cleaned.lastIndexOf('.');
  const comma = cleaned.lastIndexOf(',');
  const separator = Math.max(dot, comma);
  let normalized;
  if (separator >= 0 && cleaned.length - separator - 1 === 2) {
    normalized = cleaned.slice(0, separator).replace(/[^\d]/g, '') + '.' + cleaned.slice(separator + 1);
  } else {
    normalized = cleaned.replace(/[^\d]/g, '');
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 1000000 ? Math.round(amount * 100) : null;
}

export function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const matched = MERCHANTS.find(merchant => merchant.terms.some(term => lines.some(line => term.test(line))));
  const header = lines.slice(0, 6).find(line => /[a-z]{3}/i.test(line) && !/^(receipt|invoice|thank you|date|tel|phone|hst|gst)/i.test(line));
  const store = matched?.name ?? header?.replace(/[^\p{L}\p{N} &'-.]/gu, '').trim().slice(0, 60) ?? '';
  const totalLabels = /\b(grand\s*total|amount\s*due|balance\s*due|total\s*due|total\s*paid|purchase\s*total|total)\b/i;
  const excluded = /\b(subtotal|sub\s*total|tax|hst|gst|pst|change|cash\s*tendered|savings|discount|tip|items?)\b/i;
  let cents = null;
  // Prefer the last explicit total. It is usually more reliable than the highest number on the page.
  for (const line of lines) {
    if (!totalLabels.test(line) || excluded.test(line)) continue;
    const afterLabel = line.slice(line.search(totalLabels)).replace(totalLabels, '');
    const amounts = [...afterLabel.matchAll(/(?:\$\s*)?\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})\b/g)];
    const value = amounts.length ? parseMoney(amounts.at(-1)[0]) : null;
    if (value !== null) cents = value;
  }
  return { store, cents, category: categoryForStore(store) };
}
