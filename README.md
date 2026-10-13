# Receiptwise

A browser-based receipt scanner and expense tracker. Upload a photo, extract the store and total with OCR, review the result, and save an expense under a suggested category. Includes monthly and lifetime totals, spending breakdown, store search, category filter, deletion, and CSV export.

## Run locally

Install [Node.js](https://nodejs.org/) 20.19+ or 22.12+, then open this folder in VS Code. In its terminal:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal. Run `npm run build` to check the production build.

## How it works

- Tesseract.js reads image text in the browser. Its language/engine files may need to download on the first scan, so scanning needs an internet connection initially.
- `src/receipt.js` matches known merchant names, finds lines marked TOTAL, and extracts the amount. Store-based categories are suggestions, not item-level classifications. Edit `MERCHANTS` to add more stores.
- Review and correct the store, amount, category, and date before clicking **Save expense**. Walmart is suggested as Groceries, but a purchase there might belong to Shopping; the user decides.
- Expenses are saved in this browser's localStorage in CAD. Receipt photos and extracted text are not saved. There is no account or cross-device sync. Clear browser storage and the expenses disappear, so export CSV for a backup.

## Files

- `src/main.js` — interface, OCR, history, local storage, CSV
- `src/receipt.js` — merchant matching and receipt parsing
- `src/style.css` — responsive styling
- `src/receipt.test.js` — parser checks

## Try it

Upload a clear, upright image of a receipt with a visible TOTAL line. Check the store and total before saving. Try receipts from different stores, then search, filter, export, and delete an expense. You can also add an expense without a photo.

## Known limitations

OCR can fail on blurry or unusual receipts. The parser picks the last clearly labeled total and may need manual correction. Dates are entered by the user. A local browser version is good for a portfolio demo; accounts, database sync, and richer item-level classification could be added later.
