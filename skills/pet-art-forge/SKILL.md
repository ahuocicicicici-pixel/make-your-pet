---
name: pet-art-forge
description: >
  从用户上传的【真实宠物照片】生成一整套 57 动作的桌宠逐帧动画——把照片用提示词转成
  统一的 kawaii 贴纸画风，先产出一张"主视觉"给客户确认像不像、风格对不对，确认后再以主视觉
  为参考批量出全部动作。适用于"用我家猫/狗的照片做一只桌宠"、给 COCO 雪纳瑞换成别的宠物、
  补齐自定义角色缺失的动画帧。
  ⚠️ 本 skill 依赖图像生成模型 image2（图生图 image-to-image），image2 在 Codex 工具链里——
  所以这个 skill 最适合在 **Codex** 里运行；Claude 这边无法直接调 image2，只能产出提示词清单交给 Codex/人工出图。
---

# Pet Art Forge（照片 → 桌宠全套动画）

把**一张真实宠物照片**转成桌宠需要的**57 个动作全套动画**。核心是图生图（image-to-image）：
照片提供"这只动物长什么样"（毛色/花纹/品种/五官），提示词只负责把它**统一到目标画风**并**摆出每个动作的姿势**。动作清单、帧数、帧率、循环、参考绑定、一致性校验都与物种无关——换一张照片就是一只新宠物。

> **平台：Codex**（image2 图生图在 Codex 工具链里）。Claude/其它环境只能跑到"产出每帧提示词清单"这一步，再把清单 + 照片交给 Codex 或任意图生图工具出图。

## 何时用
- "用我家这只猫的照片做一只桌面宠物。"
- "把 COCO 换成我自己的狗/猫/仓鼠。"
- "我有宠物照片，帮我生成这套画风的全套动作。"

## 产出
```
assets/anim/<action-id>/frame_NN.png   # 512×512 RGBA 透明、居中
```
覆盖 manifest.json 里全部 57 个动作（帧数/帧率/循环以 `assets/anim/manifest.json` 为唯一契约，本 skill 绝不自己编帧数）。

---

## 总流程（照片驱动 · 主视觉先确认）

```
0. 收图    用户上传 1–3 张宠物照片（正面清晰、光线好最佳）
1. 读图    从照片提取身份要素 → 轻量角色档案(物种/毛色/花纹/五官/配饰)
2. 主视觉  ★ 图生图：照片 → 目标画风的「主视觉」(端坐正面 master 图)
           ★★ 停下，把主视觉发给客户确认："像不像 + 画风喜不喜欢"
           不通过就调提示词/换参考重出，直到客户满意——这是整套的命门
3. 锚点    以确认的主视觉为参考，图生图再生成另外 5 个姿势锚点(挥手/打滚/蜷睡/舔爪/趴看)
4. 批量    每个动作以 (主视觉 + 该动作锚点 + 该动作第0帧) 为参考，逐帧图生图出 57 套
5. 校验    consistency-check.js → 尺寸/帧数/透明/调色一致/同动作不变大变小 → 57/57 ✅
```

**为什么主视觉先行**：一旦主视觉定稿（既像本尊、画风又对），后面 280+ 帧全部以它为图生图参考，
风格和长相就锁死了，不会漂。所以**主视觉没过客户确认，绝不进入批量**。

---

## Stage 0–1 — 收图 + 读图（照片是身份的唯一来源）

1. 让用户给 **1–3 张照片**：最好有一张**正面、全身或大半身、光线均匀**的；多张能帮模型理解花纹分布。
2. 看图填一份**轻量角色档案** `templates/character-bible.template.json`——注意：这里的字段是
   **从照片观察到的**（不是凭空编），用来给提示词补充文字约束、并驱动调色校验：
   - `species.type` / `bodyType`（如 `橘猫 / 圆胖大头短腿`）
   - `coloring.primary/secondary` + **取色 hex**（从照片吸色，驱动 §5 调色漂移检测）
   - `coloring.pattern`（如 `经典鲭鱼纹、额头 M 纹`）
   - `landmarks[]`（必须保留的特征：眼睛颜色/鼻子/胡须/耳朵）
   - `outfit[]`（要给桌宠固定戴的配饰，如蓝马甲粉项圈；照片没有也可以加）
   - `style.*`（**目标画风**——默认沿用 COCO 这套：kawaii 贴纸、粗描边、白色模切边、柔和厚涂）
   - `personality`（影响后续聊天语气，不影响出图）
3. 把照片存到 `art/characters/<id>/source/`，作为所有图生图的**身份参考**。

> 画风是**固定目标**（写在 `templates/prompt-scaffolding.json` 的 STYLE 槽，对所有宠物一样），
> 身份来自**照片**——这就是"把任意照片转成同一种画风"的关键分工。

---

## Stage 2 — 主视觉（★ 客户确认门）

目标：产出一张 **master 主视觉**——你这只宠物、目标画风、端坐正面中性微笑（= `idle` 第 0 帧，也就是 `ref-00-master`）。

Codex 出图（image2 图生图）：
- **输入**：用户照片（image-to-image 参考）+ 主视觉提示词
- **提示词** = `STYLE 前缀(目标画风)` + `"端坐正面、中性微笑、全身入画"` + `TECH 后缀(512²/透明/居中)` + `负面词`
  并显式要求：**保留照片里这只动物的毛色、花纹、品种特征**，只改成贴纸画风。
- 出 2–4 个候选，挑最像 + 画风最对的一张。

**然后停下，把主视觉发给客户确认两件事：①像不像本尊 ②喜不喜欢这个画风。**
- 不像 → 加强图生图对照片的依赖 / 换更清晰的照片 / 在提示词里点名特征（"额头白斑""左耳缺角"）。
- 画风不对 → 调 STYLE 槽。
- 反复直到客户点头。**确认前不要往下走。**

确认后：把它存为 `art/characters/<id>/ref-00-master.png`，这是后续一切的锚。

---

## Stage 3 — 5 个姿势锚点（以主视觉为参考再生）

用确认好的主视觉做图生图，re-pose 出另外 5 个姿势锚点（和 COCO 的 `ref-00…ref-05` 同角色）：
`sit / wave / sprawl / curl / paw-to-mouth / lying-focus`。`templates/reference-binding.json` 把 57 个动作各映射到最合适的锚点。

每个锚点都以 `ref-00-master` 为图生图参考 → 保证 6 个锚点是**同一只**。

---

## Stage 4 — 批量出 57 动作（图生图，逐帧锁一致）

每帧提示词由四槽拼成，只有**动作描述**逐帧变、只有**角色档案/照片**逐宠物变：
```
[STYLE 前缀] + [逐帧动作描述 (actions.template.js，[animal] 等占位→档案)] + [TECH 后缀] + [负面词]
```
图生图参考叠放（最关键的一致性杠杆）：
- 该动作的**姿势锚点** + `ref-00-master`（锁长相/画风）
- 该动作的**第 0 帧**（锁这组动作内部的姿态连续）→ 用来出第 1..N 帧

TECH 后缀固定带一句：*"same exact character, identical scale & centering as the other frames of this action, only the pose changes"* —— 防止同一动作里宠物忽大忽小。

分级出（降低风险）：先 `idle,eat` 两组复核 → Tier1(22 核心) → Tier2 → Tier3(彩蛋)。
命令见 `scripts/generate-frames.js`（`--action idle,eat` / `--tier 1`）。

> 在 Codex 里，generate-frames 的 adapter 走 image2；在没有 image2 的环境，用 `--adapter manual`
> 只产出每帧 `.txt` 提示词 + 该帧要用的参考图清单，人工/其它工具出图后按 `frame_NN.png` 放回。

---

## Stage 5 — 一致性校验
`scripts/consistency-check.js`（`tools/check-assets.js` 的超集），对照同一个 `manifest.json`：

| 检查 | 不过 |
|---|---|
| 帧数 | 文件夹帧数 ≠ manifest `frames` |
| 尺寸 | 任一帧 ≠ 512×512 |
| 透明 | PNG 非 RGBA(类型 4/6) |
| 调色一致 | 不透明区主色偏离档案 hex 太远（长相漂移） |
| 同动作缩放 | 角色包围盒在一组帧间变化超阈值（忽大忽小） |

全过且退出码 0 才算完成；`--tier 1` 支持分阶段验收。

---

## 失败回退
- **不像本尊**：换更清晰/正面的照片；图生图 strength 调低（更贴原图）；提示词点名标志特征。
- **画风漂移**：强制把 `ref-00-master` + 上一帧当参考，提示词顶 `same exact character as the reference`，帧数压到 4–6。
- **没有 image2（非 Codex 环境）**：`--adapter manual` 导出 57 组提示词 + 参考清单，交给 Codex 或任意图生图工具。App 端缺帧会自动回退精灵图，**填一个动作文件夹就升级一个动作，不必等 57 个全齐**。
- **某动作 ❌**：只重跑那个动作那几帧。

## 文件
```
SKILL.md                                  ← 本文件（照片驱动 · Codex/image2）
templates/
  character-bible.template.json           ← 从照片观察填写的轻量身份档案
  actions.template.js                     ← 57 动作: tier/frames/fps/loop + 逐帧描述(占位符)
  reference-binding.json                  ← 动作 → 姿势锚点 映射
  prompt-scaffolding.json                 ← 固定 STYLE 前缀 / TECH 后缀 / 基础负面词
scripts/
  build-prompt.js                         ← 档案 + 动作 → 逐帧提示词(可只产清单)
  generate-frames.js                      ← 编排(tier/action 过滤, 调 image2 adapter)
  consistency-check.js                    ← 超集校验
  adapters/
    README.md                             ← 适配器写法
    image2.template.js                    ← Codex image2 图生图适配器(主用)
    manual.js                             ← 导出提示词 .txt 给人工/其它工具
examples/
  cat-orange-tabby.json / shiba-inu.json / baby-dino.json   ← 示例档案(配合照片用)
```
