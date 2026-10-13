import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, categoryForStore } from './receipt.js';

test('finds restaurant store and final total instead of subtotal', () => {
  assert.deepEqual(parseReceipt("McDonald's\nSubtotal $10.00\nHST $1.30\nTOTAL $11.30"), { store: "McDonald's", cents: 1130, category: 'Eating out' });
});
test('finds grocery store and amount due', () => {
  assert.deepEqual(parseReceipt('WALMART\nItem 55.00\nAMOUNT DUE 57.99'), { store: 'Walmart', cents: 5799, category: 'Groceries' });
});
test('never invents a total from a subtotal', () => {
  assert.equal(parseReceipt('Example Market\nSUBTOTAL $12.00\nTAX $1.56').cents, null);
});
test('unknown merchant remains Other', () => {
  assert.equal(categoryForStore('Local Bookshop'), 'Other');
});
