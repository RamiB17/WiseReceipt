import { createWorker } from 'tesseract.js';
import { CATEGORIES, categoryForStore, parseMoney, parseReceipt } from './receipt.js';
import './style.css';

const KEY = 'WiseReceipt.entries.v1';
const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
const today = () => new Date().toLocaleDateString('en-CA');
const safeText = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
let entries = load();
let imageUrl = null;
let scanning = false;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(e => e && typeof e.store === 'string' && Number.isInteger(e.cents) && e.cents > 0 && CATEGORIES.includes(e.category) && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];
  } catch { return []; }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(entries)); }
function categoryOptions(selected) { return CATEGORIES.map(c => `<option ${c === selected ? 'selected' : ''}>${c}</option>`).join(''); }

document.querySelector('#app').innerHTML = `
  WiseReceipt<header class="topbar"><div class="wrap top-inner"><a class="brand" href="#top"><span class="brand-icon">↗</span> WiseReceipt<span class="brand-dot">.</span></a><span class="top-note">Your spending, made clear.</span></div></header>
  <main class="wrap" id="top">
    <section class="hero"><div class="eyebrow">A SMARTER WAY TO TRACK SPENDING</div><h1>Know where<br><em>it goes.</em></h1><p>Turn a receipt photo into a clear picture of your spending. Review the details, save it, and spot patterns over time.</p></section>
    <div class="layout"><section class="panel upload-panel" aria-labelledby="upload-title"><div class="section-heading"><span class="section-number">01 / SCAN</span><h2 id="upload-title">Add a receipt</h2></div>
      <label class="dropzone" id="dropzone" for="receipt-file"><span class="upload-symbol">↑</span><strong>Choose a receipt photo</strong><span>JPG, PNG, or WebP · up to 10 MB</span><input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
      <div id="preview" class="preview" hidden><img id="preview-image" alt="Selected receipt"><button id="remove-image" class="text-button" type="button">Remove image</button></div>
      <button id="scan" class="button primary full" type="button" disabled>Scan receipt <span>→</span></button><p class="hint">Text recognition runs in your browser. Check the details before saving.</p><p id="status" class="status" role="status" aria-live="polite"></p>
      <div class="divider"><span>REVIEW DETAILS</span></div>
      <form id="entry-form"><div class="field"><label for="store">Store</label><input id="store" name="store" placeholder="e.g. McDonald's" required maxlength="60" autocomplete="off"></div><div class="two-fields"><div class="field"><label for="amount">Total (CAD)</label><input id="amount" name="amount" type="number" placeholder="0.00" min="0.01" max="1000000" step="0.01" required></div><div class="field"><label for="date">Date</label><input id="date" name="date" type="date" required></div></div><div class="field"><label for="category">Category</label><select id="category" name="category">${categoryOptions('Other')}</select></div><button class="button dark full" type="submit">Save expense <span>↗</span></button></form>
    </section><section class="dashboard" aria-labelledby="overview-title"><div class="section-heading"><span class="section-number">02 / OVERVIEW</span><h2 id="overview-title">Your overview</h2></div><div class="stat-row"><article class="stat main-stat"><span>THIS MONTH</span><strong id="month-total">$0.00</strong><small id="month-caption">0 expenses recorded</small></article><article class="stat"><span>ALL TIME</span><strong id="all-total">$0.00</strong><small id="all-caption">0 expenses recorded</small></article></div><div class="breakdown card"><div class="card-heading"><h3>By category</h3><span id="breakdown-caption">All recorded expenses</span></div><div id="categories"></div></div></section></div>
    <section class="history"><div class="section-heading history-heading"><div><span class="section-number">03 / HISTORY</span><h2>Recent expenses</h2></div><button class="text-button" id="export" type="button">Export CSV ↓</button></div><div class="history-tools"><label for="search" class="sr-only">Search by store</label><input id="search" type="search" placeholder="Search stores..."><label for="filter" class="sr-only">Filter by category</label><select id="filter"><option value="All">All categories</option>${categoryOptions('')}</select></div><div id="history-list" class="history-list"></div></section>
  </main><footer class="wrap footer">WiseReceipt <span>·</span> A personal spending tracker</footer>`;

const $ = selector => document.querySelector(selector);
$('#date').value = today();
$('#store').addEventListener('input', e => { $('#category').value = categoryForStore(e.target.value); });
$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);
$('#receipt-file').addEventListener('change', e => selectImage(e.target.files[0]));
$('#remove-image').addEventListener('click', () => { $('#receipt-file').value = ''; selectImage(null); });
const drop = $('#dropzone');
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('dragging'); });
drop.addEventListener('drop', e => selectImage(e.dataTransfer.files[0]));
function selectImage(file) {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
  $('#preview').hidden = true;
  $('#scan').disabled = true;
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { $('#status').textContent = 'Choose a JPG, PNG, or WebP image under 10 MB.'; return; }
  imageUrl = URL.createObjectURL(file);
  $('#preview-image').src = imageUrl;
  $('#preview').hidden = false;
  $('#scan').disabled = false;
  $('#status').textContent = 'Image ready. Select Scan receipt.';
}
$('#scan').addEventListener('click', async () => {
  if (!imageUrl || scanning) return;
  scanning = true; $('#scan').disabled = true;
  $('#status').textContent = 'Reading receipt… this can take a moment on the first scan.';
  let worker;
  try {
    worker = await createWorker('eng');
    const result = await worker.recognize($('#receipt-file').files[0] || imageUrl);
    const parsed = parseReceipt(result.data.text);
    if (parsed.store) $('#store').value = parsed.store;
    if (parsed.cents !== null) $('#amount').value = (parsed.cents / 100).toFixed(2);
    $('#category').value = parsed.category;
    $('#status').textContent = parsed.cents !== null ? 'Scan complete. Confirm the store, total, and category.' : 'Text was read, but the total was unclear. Enter it manually before saving.';
  } catch (error) {
    console.error('Receipt scan failed:', error);
    $('#status').textContent = 'Could not scan this image. Check your connection or enter the details manually.';
  } finally {
    if (worker) await worker.terminate();
    scanning = false; $('#scan').disabled = !imageUrl;
  }
});
$('#entry-form').addEventListener('submit', e => {
  e.preventDefault();
  const store = $('#store').value.trim();
  const cents = parseMoney($('#amount').value);
  const date = $('#date').value;
  if (!store || cents === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !CATEGORIES.includes($('#category').value)) { $('#status').textContent = 'Enter a store, a valid total, and a date.'; return; }
  entries.unshift({ id: crypto.randomUUID(), store, cents, category: $('#category').value, date });
  try { persist(); } catch { entries.shift(); $('#status').textContent = 'Storage is full or unavailable. Could not save expense.'; return; }
  $('#entry-form').reset(); $('#date').value = today(); $('#receipt-file').value = ''; selectImage(null);
  $('#status').textContent = 'Expense saved.'; render();
});
$('#history-list').addEventListener('click', e => {
  const button = e.target.closest('button[data-id]');
  if (!button || !confirm('Delete this expense?')) return;
  const previous = entries;
  entries = entries.filter(entry => entry.id !== button.dataset.id);
  try { persist(); render(); } catch { entries = previous; $('#status').textContent = 'Could not delete expense.'; }
});
$('#export').addEventListener('click', () => {
  if (!entries.length) return;
  const cell = value => `"${String(value).replaceAll('"', '""')}"`;
  const csv = ['Date,Store,Category,Amount (CAD)', ...entries.map(e => [e.date, e.store, e.category, (e.cents / 100).toFixed(2)].map(cell).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'WiseReceipt-expenses.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function render() {
  const total = entries.reduce((sum, e) => sum + e.cents, 0);
  const month = today().slice(0, 7);
  const current = entries.filter(e => e.date.startsWith(month));
  $('#month-total').textContent = money(current.reduce((sum, e) => sum + e.cents, 0));
  $('#all-total').textContent = money(total);
  $('#month-caption').textContent = `${current.length} expense${current.length === 1 ? '' : 's'} recorded`;
  $('#all-caption').textContent = `${entries.length} expense${entries.length === 1 ? '' : 's'} recorded`;
  $('#export').disabled = !entries.length;
  const totals = CATEGORIES.map(category => ({ category, cents: entries.filter(e => e.category === category).reduce((sum, e) => sum + e.cents, 0) })).filter(item => item.cents > 0).sort((a, b) => b.cents - a.cents);
  $('#categories').innerHTML = totals.length ? totals.map(item => `<div class="category-row"><div class="category-label"><span>${safeText(item.category)}</span><strong>${money(item.cents)}</strong></div><div class="track"><div class="fill" style="width:${(item.cents / total * 100).toFixed(1)}%"></div></div></div>`).join('') : '<p class="empty-small">Your spending breakdown will appear here.</p>';
  const query = $('#search').value.trim().toLowerCase();
  const filter = $('#filter').value;
  const visible = [...entries].filter(e => e.store.toLowerCase().includes(query) && (filter === 'All' || filter === e.category)).sort((a, b) => b.date.localeCompare(a.date));
  $('#history-list').innerHTML = visible.length ? visible.map(e => `<article class="expense"><div class="expense-icon">${safeText(e.store.charAt(0).toUpperCase())}</div><div class="expense-detail"><strong>${safeText(e.store)}</strong><span>${safeText(e.category)} · ${safeText(e.date)}</span></div><strong class="expense-amount">${money(e.cents)}</strong><button type="button" class="delete" data-id="${safeText(e.id)}" aria-label="Delete expense from ${safeText(e.store)}">×</button></article>`).join('') : `<div class="empty-state"><span>⌁</span><h3>${entries.length ? 'No matching expenses' : 'No receipts yet'}</h3><p>${entries.length ? 'Try another search or category.' : 'Upload a receipt or enter an expense to get started.'}</p></div>`;
}
render();
