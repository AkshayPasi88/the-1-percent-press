#!/usr/bin/env node
// build_pptx_4x5.js — Export slide_*.html (authored at 1024×1280, 4:5 portrait)
// into a TRUE 4:5 PPTX (default 8×10in) using the skill's html2pptx converter.
//
// Usage:
//   NODE_PATH=/home/z/.npm-global/lib/node_modules \
//     node /home/z/my-project/scripts/build_pptx_4x5.js \
//     /home/z/my-project/download/slides /home/z/my-project/download/out.pptx [W=8] [H=10]
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/z/my-project/skills/pptx/html2pptx1.js');

async function main() {
  const [slidesDir, outPath, wArg, hArg] = process.argv.slice(2);
  if (!slidesDir || !outPath) {
    console.error('Usage: node build_pptx_4x5.js <slides_dir> <out.pptx> [widthIn=8] [heightIn=10]');
    process.exit(1);
  }
  const W = parseFloat(wArg || '8');
  const H = parseFloat(hArg || '10');

  const htmlFiles = fs.readdirSync(slidesDir)
    .filter(f => /^slide.*\.html$/i.test(f))
    .sort()
    .map(f => path.join(slidesDir, f));
  if (htmlFiles.length === 0) throw new Error('No slide_*.html found in ' + slidesDir);

  console.log(`${htmlFiles.length} pages -> ${outPath} (${W}x${H}in portrait)`);

  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'PORTRAIT_4x5', width: W, height: H });
  pptx.layout = 'PORTRAIT_4x5';

  // Pre-allocate slides in filename order so final order is deterministic.
  const tasks = htmlFiles.map(htmlFile => ({ htmlFile, slide: pptx.addSlide() }));
  const mustFix = [];
  let next = 0, done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      const { htmlFile, slide } = tasks[i];
      const base = path.basename(htmlFile);
      try {
        const { warnings } = await html2pptx(htmlFile, pptx, { slide });
        (warnings || []).forEach(w => {
          if (w.includes('MUST FIX')) {
            mustFix.push(`${base}: ${w}`);
            console.error(`  🚨 ${base}: ${w}`);
          } else {
            console.warn(`  ⚠ ${base}: ${w}`);
          }
        });
      } catch (err) {
        console.error(`  [error] ${base}: ${err.message}`);
      }
      done++;
      console.log(`  [${done}/${tasks.length}] ${base}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, worker));

  if (mustFix.length) {
    console.error(`\n🚨 ${mustFix.length} page(s) with SEVERE overflow — MUST FIX and re-run:`);
    mustFix.forEach(m => console.error('   - ' + m));
  }

  await pptx.writeFile({ fileName: outPath });
  console.log('saved: ' + outPath);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
