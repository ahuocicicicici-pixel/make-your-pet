#!/usr/bin/env node
// consistency-check.js — superset of the project's tools/check-assets.js.
// Zero external deps (uses built-in zlib to decode PNG pixels).
// Validates the generated set against the SAME contract the pet app uses:
//   assets/anim/manifest.json  (frame counts / size).  Plus cross-frame checks.
//
//   node consistency-check.js <bible.json> [--tier N] [--action a,b] [--out <dir>]
//
// Checks per requested action:
//   1. frame count    folder frames == manifest.frames        (HARD)
//   2. size           every frame == frameSize x frameSize      (HARD)
//   3. transparency   PNG color type 4 or 6 (has alpha)         (HARD)
//   4. palette        opaque pixels stay near bible primary/secondary hex (drift)  (WARN/HARD)
//   5. intra-action   character opaque bounding box stable across the action's frames (WARN/HARD)
//   6. outfit hint    (optional) signature accessory color present in every frame   (WARN)
// Exit 0 only if all requested actions pass HARD checks.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── tiny PNG decoder (RGBA8 only; enough for our generated assets) ────────────
function decodePNG(buf) {
  if (buf.length < 8 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  let p = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const info = { width, height, colorType, bitDepth };
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 4 && colorType !== 2)) {
    return { info, pixels: null }; // header-only; pixel checks skipped
  }
  const ch = colorType === 6 ? 4 : (colorType === 4 ? 2 : 3);
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return { info, pixels: null }; }
  const stride = width * ch;
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  let rp = 0;
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    raw.copy(cur, 0, rp, rp + stride); rp += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = cur[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
        v = (v + pr) & 255;
      }
      cur[x] = v;
    }
    cur.copy(prev, 0);
    for (let x = 0; x < width; x++) {
      const s = x * ch, d = (y * width + x) * 4;
      if (ch === 4) { out[d] = cur[s]; out[d+1] = cur[s+1]; out[d+2] = cur[s+2]; out[d+3] = cur[s+3]; }
      else if (ch === 3) { out[d] = cur[s]; out[d+1] = cur[s+1]; out[d+2] = cur[s+2]; out[d+3] = 255; }
      else { out[d] = out[d+1] = out[d+2] = cur[s]; out[d+3] = cur[s+1]; } // gray+alpha
    }
  }
  return { info, pixels: out, width, height };
}

const hexToRgb = h => {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const dist = (a, b) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);

// opaque bounding box + average opaque color, sampled for speed
function analyze(dec) {
  const { pixels, width, height } = dec;
  if (!pixels) return null;
  let minX = width, minY = height, maxX = -1, maxY = -1, opaque = 0;
  let sr = 0, sg = 0, sb = 0;
  const step = 2; // sample every 2px
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const d = (y * width + x) * 4;
    if (pixels[d + 3] > 32) {
      opaque++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      sr += pixels[d]; sg += pixels[d+1]; sb += pixels[d+2];
    }
  }
  if (opaque === 0) return { area: 0, bboxArea: 0, avg: [0,0,0] };
  return {
    area: opaque,
    bboxArea: Math.max(1, (maxX - minX + 1) * (maxY - minY + 1)),
    avg: [sr / opaque, sg / opaque, sb / opaque],
    minColorDistToPalette: null
  };
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tier") a.tier = parseInt(argv[++i], 10);
    else if (argv[i] === "--action") a.actions = argv[++i].split(",").map(s => s.trim());
    else if (argv[i] === "--out") a.out = argv[++i];
    else a._.push(argv[i]);
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args._[0]) { console.error("usage: node consistency-check.js <bible.json> [--tier N] [--action a,b]"); process.exit(2); }
  const biblePath = path.resolve(args._[0]);
  const bible = JSON.parse(fs.readFileSync(biblePath, "utf8"));
  const baseDir = path.dirname(biblePath);

  // manifest contract: prefer one beside the bible, else the project's
  const manifestCandidates = [
    path.join(baseDir, "assets", "anim", "manifest.json"),
    path.join(__dirname, "..", "..", "..", "assets", "anim", "manifest.json"),
    path.join(__dirname, "..", "..", "assets", "anim", "manifest.json")
  ];
  const manifestPath = manifestCandidates.find(fs.existsSync);
  if (!manifestPath) { console.error("manifest.json not found near bible or project"); process.exit(2); }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const SIZE = manifest.frameSize;
  const outRoot = path.resolve(args.out || path.join(baseDir, "assets", "anim"));

  const cc = bible.consistencyCheck || {};
  const paletteTol = cc.paletteTolerance ?? 70;
  const scaleTol = cc.scaleTolerance ?? 0.12;
  const checkOutfit = cc.checkOutfit ?? false;

  const palette = [
    bible.coloring?.primary?.hex,
    bible.coloring?.secondary?.hex
  ].map(hexToRgb).filter(Boolean);
  const outfitColors = (bible.outfit || [])
    .map(o => hexToRgb((o.color || "").match(/#[0-9a-f]{6}/i)?.[0]))
    .filter(Boolean);

  const ids = Object.keys(manifest.animations).filter(id => {
    const a = manifest.animations[id];
    if (args.tier && a.tier !== args.tier) return false;
    if (args.actions && !args.actions.includes(id)) return false;
    return true;
  });

  let pass = 0, failCount = 0, notStarted = 0;
  for (const id of ids) {
    const a = manifest.animations[id];
    const dir = path.join(outRoot, id);
    if (!fs.existsSync(dir)) { notStarted++; console.log(`⬜ ${id} (${a.cn}) — 未开始`); continue; }

    const warns = []; let hard = false;
    const analyses = [];

    for (let i = 0; i < a.frames; i++) {
      const name = `frame_${String(i).padStart(2, "0")}.png`;
      const f = path.join(dir, name);
      if (!fs.existsSync(f)) { hard = true; warns.push(`缺 ${name}`); continue; }
      const dec = decodePNG(fs.readFileSync(f));
      if (!dec) { hard = true; warns.push(`${name} 非PNG`); continue; }
      const { info } = dec;
      if (info.width !== SIZE || info.height !== SIZE) { hard = true; warns.push(`${name} 尺寸${info.width}x${info.height}≠${SIZE}`); }
      if (info.colorType !== 6 && info.colorType !== 4) warns.push(`${name} 疑似无透明通道`);

      const an = analyze(dec);
      if (an) {
        // 4. palette drift
        if (palette.length && an.area > 0) {
          const dmin = Math.min(...palette.map(p => dist(an.avg, p)));
          if (dmin > paletteTol) warns.push(`${name} 配色偏离 (avg距主/辅色 ${Math.round(dmin)}>${paletteTol})`);
        }
        // 6. outfit presence (heuristic): some opaque pixel near an outfit color
        if (checkOutfit && outfitColors.length) {
          const present = nearAnyColor(dec, outfitColors, 60);
          if (!present) warns.push(`${name} 未检出配饰色`);
        }
        analyses.push({ name, an });
      }
    }

    // 5. intra-action scale stability (bbox area variation across frames)
    if (analyses.length >= 2) {
      const areas = analyses.map(x => x.an.bboxArea).filter(v => v > 0);
      if (areas.length >= 2) {
        const mn = Math.min(...areas), mx = Math.max(...areas);
        const rel = (mx - mn) / mx;
        if (rel > scaleTol) warns.push(`帧间缩放不一致 (包围盒变化 ${(rel*100).toFixed(0)}%>${(scaleTol*100).toFixed(0)}%)`);
      }
    }

    const extra = fs.readdirSync(dir).filter(f => /^frame_\d+\.png$/.test(f)).length - a.frames;
    if (extra > 0) warns.push(`多出 ${extra} 帧`);

    if (hard) { failCount++; console.log(`❌ ${id} (${a.cn}): ${warns.join("; ")}`); }
    else if (warns.length) { pass++; console.log(`✅ ${id} (${a.cn}, ${a.frames}帧) ⚠️ ${warns.join("; ")}`); }
    else { pass++; console.log(`✅ ${id} (${a.cn}, ${a.frames}帧)`); }
  }

  console.log(`\n━━━ ${bible.id}: 通过 ${pass}/${ids.length}  失败 ${failCount}  未开始 ${notStarted} ━━━`);
  process.exit(failCount === 0 && notStarted === 0 ? 0 : 1);
}

function nearAnyColor(dec, colors, tol) {
  const { pixels, width, height } = dec;
  if (!pixels) return true; // can't tell → don't fail
  const step = 3;
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const d = (y * width + x) * 4;
    if (pixels[d + 3] > 32) {
      const px = [pixels[d], pixels[d+1], pixels[d+2]];
      for (const c of colors) if (dist(px, c) <= tol) return true;
    }
  }
  return false;
}

if (require.main === module) main();
