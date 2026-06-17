#!/usr/bin/env node
// 素材交付自检：对照 manifest.json 检查每个动作的帧是否齐全、尺寸/透明是否合规。
// 用法： npm run check:assets   或   node tools/check-assets.js
const fs   = require("fs");
const path = require("path");

const root     = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "assets/anim/manifest.json"), "utf8")
);
const SIZE = manifest.frameSize;

function pngInfo(file) {
  const b = fs.readFileSync(file);
  // PNG signature + IHDR: width@16, height@20, colorType@25
  if (b.length < 26 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), color: b[25] };
}

const ids   = Object.keys(manifest.animations);
let   done  = 0;
const todo  = [];

for (const id of ids) {
  const a   = manifest.animations[id];
  const dir = path.join(root, manifest.frameDir, id);

  if (!fs.existsSync(dir)) { todo.push(`⬜ ${id} (${a.cn}) — 未开始`); continue; }

  const warns = [];
  let   hard  = false;

  for (let i = 0; i < a.frames; i++) {
    const name = `frame_${String(i).padStart(2, "0")}.png`;
    const f    = path.join(dir, name);
    if (!fs.existsSync(f)) { hard = true; warns.push(`缺 ${name}`); continue; }
    const info = pngInfo(f);
    if (!info)                                  { hard = true; warns.push(`${name} 非PNG`); }
    else {
      if (info.w !== SIZE || info.h !== SIZE)   { hard = true; warns.push(`${name} 尺寸${info.w}x${info.h}≠${SIZE}`); }
      if (info.color !== 6 && info.color !== 4) {              warns.push(`${name} 疑似无透明通道`); }
    }
  }

  const extra = fs.readdirSync(dir).filter(f => /^frame_\d+\.png$/.test(f)).length - a.frames;
  if (extra > 0) warns.push(`多出 ${extra} 帧`);

  if (hard)              console.log(`❌ ${id} (${a.cn}): ${warns.join("; ")}`);
  else if (warns.length) { done++; console.log(`✅ ${id} (${a.cn}, ${a.frames}帧) ⚠️ ${warns.join("; ")}`); }
  else                   { done++; console.log(`✅ ${id} (${a.cn}, ${a.frames}帧)`); }
}

console.log(`\n━━━ 进度 ${done}/${ids.length} 个动作完成 ━━━`);
if (todo.length) {
  console.log(`未开始 (${todo.length}):`);
  for (const t of todo) console.log("  " + t);
}
process.exit(done === ids.length ? 0 : 1);
