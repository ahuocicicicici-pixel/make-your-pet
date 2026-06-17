#!/usr/bin/env node
// generate-frames.js — orchestrator. Model-agnostic.
// Resolves which frames to make (tier / action filters), builds each prompt via
// build-prompt.js, gathers reference images, calls the chosen adapter, writes PNGs.
//
//   node generate-frames.js <bible.json> --adapter <name> [options]
//
//   --adapter <name>     adapter file in ./adapters/<name>.js   (default: manual)
//   --tier N             only actions of this tier (1|2|3)
//   --action a,b         only these action ids
//   --out <dir>          output root (default: <bible-dir>/assets/anim)
//   --refs <dir>         reference-image dir (default: <bible-dir>/references)
//   --force              regenerate even if frame already exists
//   --dry                print plan, generate nothing
//
// Phased delivery: run --tier 1 first, verify, then --tier 2, --tier 3.

const fs = require("fs");
const path = require("path");
const { buildFramePrompt, ACTIONS, BINDING } = require("./build-prompt.js");

function parseArgs(argv) {
  const a = { _: [], adapter: "manual", force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--adapter") a.adapter = argv[++i];
    else if (v === "--tier") a.tier = parseInt(argv[++i], 10);
    else if (v === "--action") a.actions = argv[++i].split(",").map(s => s.trim());
    else if (v === "--out") a.out = argv[++i];
    else if (v === "--refs") a.refs = argv[++i];
    else if (v === "--force") a.force = true;
    else if (v === "--dry") a.dry = true;
    else a._.push(v);
  }
  return a;
}

// 主视觉 = idle 第0帧：从用户真实照片图生图（照片驱动的核心锚）
const isMasterFrame = (actionId, frameIndex) => actionId === "idle" && frameIndex === 0;

function resolveRefs(bible, baseDir, actionId, frameIndex, refsDir, outRoot) {
  const out = [];
  const tryPush = p => { if (p && fs.existsSync(p)) out.push(p); };

  // ★ 主视觉：用用户上传的真实宠物照片做 image-to-image 参考。
  // 无条件列出（这是给用户/Codex 的指令；照片在出图时到位即可），不因本机暂缺文件而过滤。
  if (isMasterFrame(actionId, frameIndex)) {
    for (const ph of (bible.sourcePhotos || [])) out.push(path.resolve(baseDir, ph));
    return [...new Set(out)].slice(0, 3);
  }

  // 其余帧：本动作 frame_00（组内连贯）+ 姿态锚点 + 主视觉(master)
  const anchorKey = BINDING.actionToAnchor[actionId] || (ACTIONS[actionId] || {}).anchor || "sit";
  const anchor = BINDING.anchors[anchorKey];
  if (frameIndex > 0) tryPush(path.join(outRoot, actionId, "frame_00.png"));
  if (anchor) for (const ext of [".png", ".jpg", ".jpeg"]) tryPush(path.join(refsDir, anchor.ref + ext));
  // master：优先 refs/ref-00-master-sit.*，否则回退到已生成的 idle/frame_00.png
  let masterAdded = false;
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const p = path.join(refsDir, BINDING.anchors.sit.ref + ext);
    if (fs.existsSync(p)) { out.push(p); masterAdded = true; break; }
  }
  if (!masterAdded) tryPush(path.join(outRoot, "idle", "frame_00.png"));
  return [...new Set(out)].slice(0, 3);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args._[0]) {
    console.error("usage: node generate-frames.js <bible.json> --adapter <name> [--tier N] [--action a,b] [--force] [--dry]");
    process.exit(2);
  }
  const biblePath = path.resolve(args._[0]);
  const bible = JSON.parse(fs.readFileSync(biblePath, "utf8"));
  const baseDir = path.dirname(biblePath);
  const outRoot = path.resolve(args.out || path.join(baseDir, "assets", "anim"));
  const refsDir = path.resolve(args.refs || path.join(baseDir, "references"));

  let generateImage;
  if (!args.dry) {
    const adapterPath = path.join(__dirname, "adapters", `${args.adapter}.js`);
    if (!fs.existsSync(adapterPath)) {
      console.error(`adapter not found: ${adapterPath}\n(did you 'cp ${args.adapter}.template.js ${args.adapter}.js'?)`);
      process.exit(2);
    }
    generateImage = require(adapterPath);
  }

  const plan = [];
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (args.tier && a.tier !== args.tier) continue;
    if (args.actions && !args.actions.includes(id)) continue;
    for (let f = 0; f < a.frames; f++) plan.push([id, f]);
  }

  console.error(`character=${bible.id}  adapter=${args.adapter}  frames=${plan.length}  out=${outRoot}`);
  if (args.dry) {
    for (const [id, f] of plan) {
      const refs = resolveRefs(bible, baseDir, id, f, refsDir, outRoot);
      console.log(`${id}/frame_${String(f).padStart(2, "0")}.png  refs=[${refs.map(r => path.basename(r)).join(", ")}]`);
    }
    return;
  }

  let made = 0, skipped = 0, failed = 0;
  for (const [id, f] of plan) {
    const outPath = path.join(outRoot, id, `frame_${String(f).padStart(2, "0")}.png`);
    if (!args.force && fs.existsSync(outPath)) { skipped++; continue; }
    const prompt = buildFramePrompt(bible, id, f);
    const refs = resolveRefs(bible, baseDir, id, f, refsDir, outRoot);
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const buf = await generateImage({
        positive: prompt.positive,
        negative: prompt.negative,
        referenceImages: refs,
        size: 512,
        outPath,
        isMaster: isMasterFrame(id, f)
      });
      if (buf) fs.writeFileSync(outPath, buf); // null = adapter wrote the file itself (e.g. manual)
      made++;
      console.error(`✓ ${id}/frame_${String(f).padStart(2, "0")}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${id}/frame_${String(f).padStart(2, "0")}: ${e.message}`);
    }
  }
  console.error(`\ndone. made=${made} skipped=${skipped} failed=${failed}`);
  console.error(`next: node ${path.relative(process.cwd(), path.join(__dirname, "consistency-check.js"))} ${args._[0]}${args.tier ? " --tier " + args.tier : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
