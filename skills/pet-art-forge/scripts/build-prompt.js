#!/usr/bin/env node
// build-prompt.js — turn a character bible into per-frame prompts.
// Pure function + CLI. No image API, no network. Species-agnostic.
//
//   node build-prompt.js <bible.json> [--tier N] [--action a,b] > prompts.json
//
// Exports buildStylePrefix(bible) and buildFramePrompt(bible, actionId, frameIndex)
// for generate-frames.js to reuse.

const fs = require("fs");
const path = require("path");

const TPL = path.join(__dirname, "..", "templates");
const ACTIONS = require(path.join(TPL, "actions.template.js"));
const SCAFFOLD = JSON.parse(fs.readFileSync(path.join(TPL, "prompt-scaffolding.json"), "utf8"));
const BINDING = JSON.parse(fs.readFileSync(path.join(TPL, "reference-binding.json"), "utf8"));

// ── identity-locking style prefix ────────────────────────────────────────────
function buildStylePrefix(bible) {
  const landmarks = (bible.landmarks || [])
    .filter(l => l && l.name && l.required !== false)
    .map(l => l.description)
    .join(", ");
  const outfit = (bible.outfit || [])
    .filter(o => o && o.detail)
    .map(o => o.detail)
    .join(", ") || "no clothing or accessories";

  const fill = {
    "personality": bible.personality || "cute",
    "species.type": bible.species.type,
    "species.age": bible.species.age || "",
    "species.bodyType": bible.species.bodyType || "",
    "coloring.primary.description": bible.coloring.primary.description,
    "coloring.secondary.description": bible.coloring.secondary
      ? bible.coloring.secondary.description : "",
    "coloring.pattern": bible.coloring.pattern || "",
    "landmarks": landmarks,
    "outfit": outfit,
    "facing": bible.facing || "facing camera",
    "style.type": bible.style.type,
    "style.technique": bible.style.technique || "",
    "style.signature": bible.style.signature || "",
    "style.palette": bible.style.palette || "balanced"
  };

  return SCAFFOLD.stylePrefixTemplate
    .replace(/\{\{([^}]+)\}\}/g, (_, k) => (fill[k.trim()] ?? "").trim())
    .replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
}

// ── placeholder substitution for per-frame action text ───────────────────────
function substitutePlaceholders(text, bible) {
  const words = bible.species.type.trim().split(/\s+/);
  const shortAnimal = words[words.length - 1].toLowerCase(); // cat / dog / dino
  return text
    .replace(/\[ANIMAL\]/g, bible.species.type)
    .replace(/\[animal\]/g, shortAnimal)
    .replace(/\[bowl\]/g, `a small ${shortAnimal} food bowl`)
    .replace(/\[toy\]/g, "a small ball");
}

// ── one frame's full prompt object ───────────────────────────────────────────
function buildFramePrompt(bible, actionId, frameIndex) {
  const action = ACTIONS[actionId];
  if (!action) throw new Error(`unknown action: ${actionId}`);
  const frameDesc = substitutePlaceholders(action.desc[frameIndex], bible);

  const negParts = [SCAFFOLD.baseNegative]
    .concat((bible.negativePalette || []).filter(s => typeof s === "string" && !s.startsWith("_doc")));

  const anchorKey = BINDING.actionToAnchor[actionId] || action.anchor || "sit";
  const anchor = BINDING.anchors[anchorKey];

  return {
    action: actionId,
    frame: frameIndex,
    file: `assets/anim/${actionId}/frame_${String(frameIndex).padStart(2, "0")}.png`,
    positive: `${buildStylePrefix(bible)} ${frameDesc}. ${SCAFFOLD.techSuffix}`
      .replace(/\s{2,}/g, " ").trim(),
    negative: negParts.join(", "),
    references: {
      anchor: anchor ? anchor.ref : null,
      master: BINDING.anchors.sit.ref,
      // frames after 0 should also pass this action's frame_00 for intra-action consistency
      previousFrameOfAction: frameIndex > 0
        ? `assets/anim/${actionId}/frame_00.png` : null
    }
  };
}

// ── build every prompt for a bible (with optional filters) ───────────────────
function buildAll(bible, { tier, actions } = {}) {
  const out = [];
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (tier && a.tier !== tier) continue;
    if (actions && !actions.includes(id)) continue;
    for (let f = 0; f < a.frames; f++) out.push(buildFramePrompt(bible, id, f));
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tier") a.tier = parseInt(argv[++i], 10);
    else if (argv[i] === "--action") a.actions = argv[++i].split(",").map(s => s.trim());
    else a._.push(argv[i]);
  }
  return a;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args._[0]) {
    console.error("usage: node build-prompt.js <bible.json> [--tier N] [--action a,b]");
    process.exit(2);
  }
  const bible = JSON.parse(fs.readFileSync(args._[0], "utf8"));
  const prompts = buildAll(bible, { tier: args.tier, actions: args.actions });
  process.stdout.write(JSON.stringify({ character: bible.id, count: prompts.length, prompts }, null, 2) + "\n");
}

module.exports = { buildStylePrefix, buildFramePrompt, buildAll, ACTIONS, BINDING };
