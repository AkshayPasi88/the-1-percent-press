// slides_to_pdf.js — Render download/slides/slide_*.html into ONE distribution
// PDF at exact 8×10in (4:5) using Playwright page.pdf (webfonts embedded,
// pixel-perfect) + pdf-lib merge.
//
// Usage:
//   NODE_PATH=/home/z/.npm-global/lib/node_modules \
//     node /home/z/my-project/scripts/slides_to_pdf.js \
//     /home/z/my-project/download/slides /home/z/my-project/download/out.pdf
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const [slidesDir, outPath] = process.argv.slice(2);
  if (!slidesDir || !outPath) {
    console.error('Usage: node slides_to_pdf.js <slides_dir> <out.pdf>');
    process.exit(1);
  }
  const files = fs.readdirSync(slidesDir)
    .filter(f => /^slide.*\.html$/i.test(f))
    .sort()
    .map(f => path.join(slidesDir, f));
  if (files.length === 0) throw new Error('No slide_*.html found in ' + slidesDir);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1280 } });
  const buffers = [];

  for (const f of files) {
    await page.goto('file://' + f, { waitUntil: 'load', timeout: 45000 });
    // Ensure webfonts are fully loaded before printing.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // 1024×1280 CSS px = 10.667×13.333in at 96dpi; scale 0.75 -> exactly 8×10in.
    const buf = await page.pdf({
      width: '8in',
      height: '10in',
      printBackground: true,
      scale: 0.75,
      pageRanges: '1'
    });
    buffers.push(buf);
    console.log('rendered ' + path.basename(f));
  }
  await browser.close();

  const merged = await PDFDocument.create();
  for (const b of buffers) {
    const doc = await PDFDocument.load(b);
    const [p] = await merged.copyPages(doc, [0]);
    merged.addPage(p);
  }
  fs.writeFileSync(outPath, await merged.save());
  console.log(`saved: ${outPath} (${files.length} pages, 8x10in)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
