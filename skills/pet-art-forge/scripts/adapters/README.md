# Image adapters

`generate-frames.js` is model-agnostic. It calls **one** function from the adapter you
pick with `--adapter <name>`. To support any image model, drop a file here that exports:

```js
module.exports = async function generateImage({ positive, negative, referenceImages, size, outPath }) {
  // positive: string prompt
  // negative: string negative prompt
  // referenceImages: string[]  (absolute paths to reference PNGs; may be empty)
  // size: number (512)
  // outPath: where the PNG should end up (the orchestrator also writes the returned buffer there)
  // RETURN: a Buffer containing a `size`×`size` RGBA PNG  (or null if you wrote the file yourself)
};
```

That's the whole contract. Examples of what a real adapter wraps:

| Model / service | Notes |
|---|---|
| OpenAI gpt-image-1 | `images.generate` / `images.edit` (edit = pass reference). See `openai.template.js`. |
| Google Gemini image | image-out model; pass refs as inline image parts. |
| Flux / SDXL (Replicate, Fal) | set `output_format: png`, `width/height: 512`; use img2img endpoint when refs exist. |
| ComfyUI / local | POST a workflow graph; read the result PNG. |
| Stability / Ideogram / etc. | any HTTP image API. |

Built-in adapters:
- **`manual.js`** — no API. Writes the prompt to `<outPath>.txt`. A human or a multimodal
  chat assistant generates the image elsewhere and saves the PNG to `<outPath>`. Lets the
  whole pipeline (filtering, naming, checking) work with zero credentials.
- **`openai.template.js`** — copy to `openai.js`, set `OPENAI_API_KEY`, and it works.

Tips for any adapter:
- Always request **PNG with transparency** (RGBA). If the model can't, post-process to
  remove the background before returning the buffer — `consistency-check.js` enforces alpha.
- Always force **square 512×512**. Resize/pad if needed.
- Pass `referenceImages` to an **edit/img2img** endpoint when the array is non-empty;
  fall back to text-to-image when empty (only the very first `ref-00` bootstrap frame).
