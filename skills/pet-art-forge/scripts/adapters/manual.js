// manual.js — zero-credential adapter.
// Writes the prompt to "<outPath>.txt" instead of calling any model.
// A human (or a multimodal chat) generates the image with the printed prompt + the
// listed reference images, then saves the resulting 512x512 RGBA PNG to <outPath>.
// The rest of the pipeline (tier/action filtering, naming, consistency-check) works
// exactly the same.
const fs = require("fs");
const path = require("path");

module.exports = async function generateImage({ positive, negative, referenceImages, size, outPath, isMaster }) {
  const banner = isMaster
    ? "★★★ 主视觉 / MASTER —— 这是整套的基准图。请用下面 REFERENCE 里的真实宠物照片做 image-to-image，\n出图后先发客户确认『像不像本尊 + 画风对不对』，确认通过再生成其余动作（它们都以本图为参考）。★★★\n\n"
    : "";
  const refLabel = isMaster
    ? "REFERENCE IMAGES = 用户上传的真实宠物照片（image-to-image，保留毛色/花纹/品种，只转画风）:"
    : "REFERENCE IMAGES (feed these to the model as image-to-image input):";
  const txt =
`${banner}# ${path.basename(path.dirname(outPath))} / ${path.basename(outPath)}
SIZE: ${size}x${size}, transparent RGBA PNG, centered, full body in frame

${refLabel}
${(referenceImages && referenceImages.length) ? referenceImages.map(r => "  - " + r).join("\n") : "  (none — text-to-image bootstrap frame)"}

POSITIVE PROMPT:
${positive}

NEGATIVE PROMPT:
${negative}
`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath + ".txt", txt, "utf8");
  // returns null: orchestrator must NOT write a PNG; the human will.
  return null;
};
