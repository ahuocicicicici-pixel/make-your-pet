// openai.template.js — EXAMPLE real adapter. Copy to "openai.js" to enable.
//   cp openai.template.js openai.js
//   export OPENAI_API_KEY=sk-...
//   node ../generate-frames.js <bible.json> --adapter openai --tier 1
//
// Wraps OpenAI's image API. When reference images are provided it uses images.edit
// (image-to-image, the key to character consistency); otherwise images.generate.
// Requires:  npm i openai   (and a key with image access)
//
// This is illustrative — adapt the SDK calls to whatever model you actually use.
// The ONLY contract that matters: return a Buffer of a 512x512 RGBA PNG (or null).

const fs = require("fs");

let OpenAI;
try { OpenAI = require("openai"); }
catch { throw new Error("npm i openai  (required by the openai adapter)"); }

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async function generateImage({ positive, negative, referenceImages, size }) {
  // Many image models don't take a separate negative field; fold it into the prompt.
  const prompt = `${positive}\n\nAvoid: ${negative}`;

  let res;
  if (referenceImages && referenceImages.length) {
    res = await client.images.edit({
      model: "gpt-image-1",
      image: referenceImages.map(p => fs.createReadStream(p)),
      prompt,
      size: `${size}x${size}`,
      background: "transparent"
    });
  } else {
    res = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: `${size}x${size}`,
      background: "transparent"
    });
  }

  const b64 = res.data[0].b64_json;
  return Buffer.from(b64, "base64"); // 512x512 RGBA PNG
};
