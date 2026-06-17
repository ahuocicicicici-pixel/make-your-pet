// image2.template.js — Codex 的 image2 图生图适配器【模板】
//
// 用法：cp image2.template.js image2.js，按你的 image2 调用方式补全 TODO，再
//   node ../generate-frames.js <bible.json> --adapter image2 --action idle
//
// 契约（所有适配器一致）：
//   输入  { positive, negative, referenceImages[], size, outPath, isMaster }
//   返回  Buffer(一张 size×size 的 RGBA 透明 PNG)  —— 编排器会写到 outPath
//         或 返回 null 表示"我自己已经把文件写到 outPath 了"
//
// ★ 关于 Codex / image2 的现实：
//   image2 在 Codex 里通常是【工具调用】，不是一个能从 node 里直接 fetch 的 HTTP API。
//   两种接法，二选一：
//
//   A) Codex 原生流（推荐，最省事）：
//      不用本适配器，直接用 `--adapter manual` 跑一遍 → 每帧生成一个 .txt(含正/负提示词
//      + 要喂的参考图清单)。然后让 Codex 逐帧读 .txt、用 image2 工具做 image-to-image
//      (把 referenceImages 作为输入图、positive/negative 作为提示词、要求 512² 透明)，
//      把结果存成同名去掉 .txt 的 frame_NN.png。主视觉(idle/frame_00, isMaster)先做、先确认。
//
//   B) 有可编程的 image2 端点/CLI 时：在下面 TODO 处接上，返回 PNG Buffer。

const fs = require("fs");

module.exports = async function generateImage({ positive, negative, referenceImages, size, outPath, isMaster }) {
  // ───────────────────────────────────────────────────────────────────────────
  // TODO: 调用你的 image2（image-to-image）。要点：
  //   - 输入参考图：referenceImages（主视觉=真实宠物照片；其余帧=主视觉+锚点+本动作frame_00）
  //   - 提示词：positive / negative
  //   - 输出：size×size、RGBA 透明、角色居中全身入画
  //   - 主视觉(isMaster=true)建议更贴近参考照片（img2img strength 调低），保住"像本尊"
  //
  // 例（伪代码，按你的实际 API 改）：
  //   const png = await image2.editImage({
  //     prompt: positive, negativePrompt: negative,
  //     initImages: referenceImages, size, transparent: true,
  //     strength: isMaster ? 0.45 : 0.65,
  //   });
  //   return Buffer.from(png);
  // ───────────────────────────────────────────────────────────────────────────

  throw new Error(
    "image2.js 还没接上真实 image2 调用。\n" +
    "→ 推荐用 Codex 原生流：先 `--adapter manual` 出每帧提示词清单，再让 Codex 用 image2 工具逐帧 image-to-image 生成。\n" +
    "→ 或在本文件 TODO 处接上你的 image2 端点后返回 PNG Buffer。"
  );

  // 占位防 lint
  void fs; void positive; void negative; void referenceImages; void size; void outPath; void isMaster;
};
