# 雪纳瑞桌宠 · 素材与动画生产 PRD（给 AI 出图用）

> 本文件是交给 Codex / image2 批量生成全部美术素材的**唯一作业指导书**。
> 配套阅读产品 PRD：[PRD.md](PRD.md)。本文件只管"画什么、怎么画、画完叫什么名、放哪里"。
>
> **使用方法（Codex 必读）**：
> 1. 先读 §2 角色设定圣经 + §3 全局生成规范 —— 这两段决定一致性，**每张图都要遵守**。
> 2. 按 §4 的工作流先产出"基准参考图"，人工确认后，把它作为 reference image 喂给后续每次生成。
> 3. 按 §6 的清单逐个动作生成；每帧的最终 prompt = `§3.2 风格前缀` + `§7 对应帧的动作描述` + `§3.3 技术后缀`。
> 4. 按 §5 命名规范输出到 `assets/anim/<动作id>/frame_NN.png`。
> 5. 全部完成后按 §8 合成精灵图并接回代码。

---

## 0. 交付契约（Definition of Done · Codex 必须满足）

**唯一真相源 = [`assets/anim/manifest.json`](assets/anim/manifest.json)**。代码按它播放，自检按它校验，你按它交付。三方对齐，不要改它的 id / 帧数。

每个动作的"完成"定义：

1. 在 `assets/anim/<动作id>/` 目录下；
2. 帧文件名 `frame_00.png` … `frame_(N-1).png`，**N = manifest 里该动作的 `frames`**；零填充两位；
3. 每帧 **512×512、PNG、带透明通道（RGBA）**、透明背景；
4. 同一动作各帧角色缩放/中心/基线一致（见 §3.1）；
5. 一眼是 §2 那只狗（用了 `references/` 对应参考图）。

**一键自检**（每做完一批都跑）：
```bash
npm run check:assets
```
输出示例：`✅ idle (待机呼吸, 6帧)` / `❌ eat: 缺 frame_03` / `⬜ dance — 未开始`，末尾给总进度 `28/57`。全绿即交付达标。

**渐进式交付**：代码已支持"缺帧自动回退"——没生成的动作会临时用旧精灵图顶替，App 始终能跑。你**每填好一个文件夹，那个动作就自动变高清**，可以边出边看，不用等 57 个全齐。建议先交 `idle`+`eat` 给我确认风格基线。

---

## 1. 为什么要重做素材

| 问题 | 现状 | 目标 |
|---|---|---|
| 模糊 | 每帧仅 192×208 物理像素，Retina 屏拉伸 ~2.4 倍 | 每帧 **512×512** 透明 PNG（@2x） |
| 动作太少 | 只有 9 个动作 | **57 个动作**，覆盖养成全流程（见 §6） |
| 没有养成表现 | 状态变化无动画 | 吃饭/洗澡/打工/生病/睡觉…均有专属动画 |

设计参照 **QQ 宠物**（见 §10 附录）：四值衰减、喂食洗澡玩耍、打工赚钱、桌面行为（饿了提示、脏了挠痒、上线打招呼、下线告别）。

---

## 2. 角色设定圣经（Character Bible · 一致性核心）

**所有图必须是同一只狗。** 把下面这段当成"演员合同"，每次生成都不能偏离。

- **品种/体型**：迷你雪纳瑞幼犬（miniature schnauzer puppy），圆滚滚的奶狗比例，大头短腿，憨态可掬。
- **毛色**：经典"椒盐色"——背部和身体是**深炭灰/近黑**，四肢、胸口、脸部和标志性大胡子是**浅银灰+奶白**。
- **标志特征**：浓密的雪纳瑞**眉毛**、长而蓬松的**络腮胡**、深色 V 形垂耳、黑色圆鼻头、又大又圆的**深棕色眼睛**（友善有神）。
- **服饰（固定不变）**：浅牛仔蓝色**背带马甲**，带粉色/玫瑰色滚边，胸口一个棕色小皮质名牌；脖子粉色项圈。
- **画风**：现代卡通 / 可爱贴纸插画（kawaii sticker），平滑粗描边，cel-shading 平涂 + 柔和渐变阴影，整体一圈**白色模切贴纸描边**（die-cut white outline），轻微投影。
- **气质**：可爱、友善、表情丰富。

**配色锁定（让 AI 尽量稳定）**：
```
深色毛: charcoal grey #4A4A4A (near-black on back)
浅色毛: silver-cream #D8D2C8
马甲:   denim blue #A9C7E0, trim pink #F4A9C0
项圈:   pink #F4A9C0
鼻子:   black / 舌头: pink
```

**参考图（必用）**：`references/` 文件夹里有 6 张同一只狗的官方造型图，**每次生成都要把对应参考图作为 reference image / image-to-image 输入传进去，不要凭空画**。哪张图配哪些动作，见 [references/README.md](references/README.md)。其中 `ref-00-master-sit.png` 是主基准图。

---

## 3. 全局生成规范

### 3.1 技术硬规格（每张图都必须满足）

| 项 | 要求 |
|---|---|
| 尺寸 | **512 × 512 px**，正方形 |
| 背景 | **完全透明**（alpha 通道，PNG-32）。不要任何地面、阴影投到背景、场景道具背景 |
| 构图 | **全身入镜**，角色居中；脚底落在画布约 88% 高度的隐形基线上；角色高度约占画布 **78–82%** |
| 关键 | **同一动作的所有帧，角色的缩放、中心位置、基线必须完全一致**（只有姿态/表情变化）。否则播放时会"跳"。这是动画能不能用的命门 |
| 朝向 | 默认面向镜头偏右 3/4 侧。需要"左"版本的（如走/跑）用代码水平镜像，**不单独画** |
| 风格 | 与 §2 完全一致；描边粗细、白色模切边宽度保持稳定，避免逐帧闪烁 |

### 3.2 风格前缀（每个 prompt 开头都加这段）

```
A cute miniature schnauzer puppy mascot, salt-and-pepper fur (dark charcoal-grey body,
silver-cream legs/chest/face), bushy schnauzer eyebrows and fluffy beard, dark floppy
V-shaped ears, big round dark-brown friendly eyes, black round nose. Wearing a light
denim-blue harness vest with pink trim and a small brown leather name tag, pink collar.
Modern kawaii sticker illustration style, clean bold outlines, soft cel-shading,
thick white die-cut sticker border, full body, character centered.
```

### 3.3 技术后缀（每个 prompt 结尾都加这段）

```
Transparent background, no background scene, no ground, no floor shadow, square 512x512,
full body fully inside frame, consistent character scale and position, high detail,
crisp edges. Same exact character as the reference image.
```

### 3.4 负面提示（Negative prompt，能传就传）

```
realistic photo, 3D render, photoreal, blurry, low-res, deformed, extra limbs, extra legs,
missing legs, mutated paws, multiple dogs, different dog breed, human, text, letters,
watermark, signature, cropped body, cut off, busy background, colored background,
dark heavy drop shadow, inconsistent style, flat no-outline
```

---

## 4. 一致性工作流（先做这步！）

AI 出图最大的坑是"每帧画得不像同一只狗"。按这个顺序做能最大程度避免：

1. **Step 0 · 立基准**：先只生成 1 张 `idle` 的第 1 帧，反复刷到满意（最像 §2 设定、最可爱）。这张就是**主基准图 master reference**。
2. **Step 1 · 锁参考**：之后每一次生成，都把 master reference（或上一帧）作为 **reference image / image-to-image 输入**传进去，提示词里强调 `Same exact character as the reference image`。
3. **Step 2 · 同组连贯**：生成同一个动作的多帧时，**用该动作第 1 帧做参考**，保证组内一致。
4. **Step 3 · 抠图保险**：如果模型输出带白底而非透明，过一道去背景（保留 §2 的白色模切描边）。
5. **Step 4 · 人工筛**：每个动作至少出 2 套候选，挑姿态最连贯的一套入库。

> 经验：走/跑这类多帧循环最难保持一致。优先把帧数压到 4–6 帧；实在不稳，就只画 1–2 个关键姿态，靠代码做上下颠簸/轻微旋转补足运动感（见 §8.3）。

---

## 5. 目录与命名规范

```
assets/
  anim/
    idle/          frame_00.png frame_01.png ... frame_05.png
    walk/          frame_00.png ...
    eat/           frame_00.png ...
    <动作id>/      frame_NN.png（NN 从 00 起，两位数，零填充）
  icon.icns        （已存在，应用图标）
```

- 一个动作一个文件夹，文件夹名 = §6 表里的"动作 id"（kebab-case）。
- 帧文件 `frame_00.png` 起，按播放顺序编号。
- 帧数以 §6 表为准；可少不可多（少了循环更稳）。

---

## 6. 动作总清单（57 个）

> `loop`=循环播放（待机/走/吃等）；`once`=播一次回到 idle（打招呼/跳等）。
> fps 为建议帧率，可微调。带 ⭐ 的是当前代码已用到、**最优先**。

### Tier 1 · 核心（v0.2–v0.3 必需，22 个）

| id | 中文 | 帧 | fps | 循环 | 用途 |
|---|---|---|---|---|---|
| `idle` ⭐ | 待机呼吸 | 6 | 4 | loop | 默认状态 |
| `blink` | 眨眼 | 4 | 6 | once | 待机随机穿插 |
| `look-around` | 张望好奇 | 6 | 5 | once | 待机彩蛋 |
| `walk` ⭐ | 走 | 6 | 8 | loop | 漫步（左版镜像） |
| `run` ⭐ | 跑 | 6 | 12 | loop | 快速移动/生气走开 |
| `drag` | 被拎起 | 4 | 6 | loop | 拖拽时四肢下垂 |
| `greet` ⭐ | 打招呼挥手 | 6 | 7 | once | 上线/召唤 |
| `happy` ⭐ | 开心蹦跳 | 6 | 8 | once | 通用正反馈 |
| `sad` | 难过 | 5 | 4 | once | 心情低 |
| `angry` ⭐ | 生气 | 6 | 7 | once | 被点烦了 |
| `love` | 被宠爱·爱心眼 | 5 | 5 | once | 抚摸高潮 |
| `head-pat` | 摸头眯眼 | 5 | 6 | once | 点头部 |
| `lick` | 舔亲亲 | 5 | 7 | once | 点脸 |
| `belly-rub` | 挠肚子翻身 | 6 | 7 | once | 点肚子 |
| `shake-paw` | 握手抬爪 | 5 | 6 | once | 点爪子 |
| `chase-tail` | 追尾巴转圈 | 8 | 10 | once | 点尾巴 |
| `eat` ⭐ | 吃饭 | 6 | 8 | loop | 喂食 |
| `sleep` | 睡觉 Zzz | 6 | 3 | loop | 夜间/手动 |
| `bath` | 洗澡泡泡 | 6 | 6 | loop | 洗澡 |
| `hungry` | 饿了·盯肚子 | 5 | 4 | once | 饱食<30 提示 |
| `dirty` | 脏了·挠痒 | 6 | 7 | loop | 清洁<30 提示 |
| `sick` | 生病·虚弱 | 5 | 3 | loop | 健康<30 |

### Tier 2 · 扩展（v0.4 打工/玩耍/经济，20 个）

| id | 中文 | 帧 | fps | 循环 | 用途 |
|---|---|---|---|---|---|
| `work-construction` | 搬砖/泥瓦匠 | 6 | 7 | loop | 打工 |
| `work-cook` | 厨师颠勺 | 6 | 7 | loop | 打工 |
| `work-guard` | 保安/警察站岗 | 5 | 5 | loop | 打工 |
| `work-art` | 画画/漫画家 | 6 | 6 | loop | 打工 |
| `study` | 学习看书 | 6 | 4 | loop | 学习 |
| `work-done` | 下班数钱 | 6 | 7 | once | 领工资 |
| `play-ball` | 玩球/扑球 | 6 | 9 | once | 玩耍 |
| `play-frisbee` | 跳起接飞盘 | 6 | 10 | once | 玩耍 |
| `jump-rope` | 跳绳 | 6 | 10 | loop | 小游戏 |
| `coin-get` | 获得金币·开心 | 5 | 7 | once | 奖励 |
| `levelup` | 升级·闪光 | 6 | 8 | once | 升级 |
| `shopping` | 逛街拎袋 | 6 | 6 | once | 购物 |
| `drink` | 喝水 | 5 | 6 | once | 日常 |
| `brush` | 被梳毛舒服 | 5 | 5 | once | 日常 |
| `wake` | 起床伸懒腰 | 6 | 5 | once | 醒来 |
| `bath-shake` | 洗完甩水 | 6 | 10 | once | 洗澡收尾 |
| `eat-full` | 吃饱满足·拍肚 | 5 | 5 | once | 喂食收尾 |
| `dizzy` | 头晕转圈眼 | 5 | 5 | loop | 状态差 |
| `yawn` | 打哈欠困了 | 5 | 4 | once | 夜晚前 |
| `excited` | 兴奋原地转 | 6 | 9 | once | 强正反馈 |

### Tier 3 · 情感彩蛋（v1.0+，15 个）

| id | 中文 | 帧 | fps | 循环 | 用途 |
|---|---|---|---|---|---|
| `goodbye` | 依依不舍告别 | 6 | 5 | once | 下线/退出 |
| `cry` | 大哭 | 6 | 5 | loop | 心情/健康极低 |
| `surprised` | 惊讶跳起 | 5 | 8 | once | 突发事件 |
| `shy` | 害羞捂脸 | 5 | 5 | once | 被夸 |
| `bored` | 无聊发呆 | 6 | 3 | loop | 长时间无操作 |
| `think` | 思考歪头 | 5 | 4 | once | 等待 |
| `peek` | 屏幕边缘探头 | 5 | 5 | once | 彩蛋出场 |
| `travel` | 背包旅游出发 | 6 | 6 | once | 旅游 |
| `celebrate` | 庆祝撒花 | 6 | 8 | once | 生日/节日 |
| `recover` | 病愈·精神 | 5 | 5 | once | 康复 |
| `scared` | 害怕发抖 | 5 | 6 | loop | 受惊 |
| `wink` | 卖萌眨眼比心 | 5 | 6 | once | 互动彩蛋 |
| `dance` | 跳舞 | 8 | 9 | loop | 娱乐 |
| `beg` | 坐立讨食 | 5 | 5 | loop | 求喂食 |
| `sneeze` | 打喷嚏 | 5 | 7 | once | 彩蛋 |

---

## 7. 逐动作提示词（中段动作描述）

> 每帧最终 prompt = **§3.2 风格前缀** + 下面对应帧的英文 + **§3.3 技术后缀**（+ §3.4 负面）。
> 下面只写"中段"——具体姿态/表情。所有帧共享同一基线与缩放（§3.1）。

### —— Tier 1 核心 ——

**`idle` 待机呼吸 [6帧 / loop]** — 站立微微呼吸起伏
```
f00: standing calmly facing camera, neutral happy face, chest at rest (lowest)
f01: chest slightly rising, breathing in, tail relaxed
f02: chest fully up, breathing in, ears settle
f03: chest at top, blinking softly, content
f04: chest lowering, breathing out
f05: back to rest, tiny tail wag
```

**`blink` 眨眼 [4帧 / once]**
```
f00: eyes fully open, neutral
f01: eyes half closed
f02: eyes fully closed, gentle smile
f03: eyes opening again
```

**`look-around` 张望好奇 [6帧 / once]**
```
f00: head straight, curious
f01: head turning to its left, ears perk
f02: looking far left, eyes wide curious
f03: head turning to its right
f04: looking far right, head tilted
f05: head back to center, satisfied
```

**`walk` 走 [6帧 / loop]** — 标准走路循环，身体水平不上下大跳
```
f00: contact pose, front-left & back-right legs forward
f01: passing pose, legs gathering under body, slight lift
f02: opposite contact, front-right & back-left legs forward
f03: contact pose mirrored, legs swapped
f04: passing pose again, body slight lift
f05: return toward f00 stride, tail wagging
(保持身体中心高度基本不变，只有腿在交替)
```

**`run` 跑 [6帧 / loop]** — 更大幅度、身体前倾、有腾空帧
```
f00: gather, all legs bunched under body, leaning forward
f01: push off, hind legs extending back, front legs reaching forward
f02: full extension / airborne, legs stretched front and back, ears flying back
f03: front legs landing, body forward
f04: gather again under body
f05: mid-stride push, tongue out happy
```

**`drag` 被拎起 [4帧 / loop]** — 被无形的手从上方拎起，四肢自然下垂
```
f00: hanging slightly, all four legs dangling down, surprised look up
f01: gently swaying left, legs dangling, ears up
f02: hanging center, blinking, a little nervous smile
f03: swaying right, tail tucked
(视角：略微从上往下，强调被悬空拎着)
```

**`greet` 打招呼挥手 [6帧 / once]** — 看到主人超开心地挥前爪
```
f00: standing, just noticed you, eyes brightening
f01: lifting right front paw, mouth opening to smile
f02: paw raised high mid-wave, big happy open-mouth smile, tail wag
f03: paw waving to the other side, eyes sparkling, tongue out
f04: paw waving back, ears bouncing
f05: paw lowering, warm happy smile
```

**`happy` 开心蹦跳 [6帧 / once]**
```
f00: crouch slightly, anticipation, smiling
f01: pushing up, front paws lifting
f02: airborne, all legs off ground, joyful open-mouth, ears up
f03: peak of jump, little sparkle, tongue out
f04: coming down, legs reaching for ground
f05: landed, happy wiggle, tail wag
```

**`sad` 难过 [5帧 / once]**
```
f00: standing, smile fading
f01: ears drooping, head lowering
f02: head down, big watery puppy eyes, sad frown
f03: tail tucked, sitting down slumped, single sad sniff
f04: looking up sadly, pleading eyes
```

**`angry` 生气 [6帧 / once]** — 被烦到了，鼓气跺脚
```
f00: frowning eyebrows down, annoyed
f01: puffing cheeks, ears back
f02: stomping front paw, angry pout, small anger vein/mark above head
f03: turning head away in a huff, eyes closed
f04: arms-crossed-like sulking posture, back slightly turned
f05: glancing back still annoyed
```

**`love` 被宠爱·爱心眼 [5帧 / once]**
```
f00: eyes softening, content
f01: eyes turning into heart shapes, blushing cheeks
f02: full heart eyes, floating small hearts around head, blissful smile
f03: nuzzling, tilting head into the affection, hearts
f04: happy sigh, eyes closed smiling, one heart floating up
```

**`head-pat` 摸头眯眼 [5帧 / once]** — 头顶被摸，舒服地眯眼
```
f00: looking up expectantly
f01: eyes starting to squint as if a hand rests on head
f02: eyes squeezed shut in bliss, head pressing up slightly, happy smile
f03: leaning into the pat, tail wagging, blush
f04: opening eyes, content grateful look
```

**`lick` 舔亲亲 [5帧 / once]** — 伸舌头往镜头方向亲
```
f00: looking at you, mouth closed
f01: leaning forward, mouth opening
f02: big tongue out reaching toward camera, eyes happy-closed
f03: licking motion, tongue curled, little heart
f04: pulling back, satisfied lick of lips
```

**`belly-rub` 挠肚子翻身 [6帧 / once]** — 翻肚皮蹬腿大笑
```
f00: standing, then starting to roll
f01: rolling onto back, legs coming up
f02: fully on back, belly up, all four legs in the air, laughing
f03: legs kicking with joy, tongue out laughing, eyes squeezed
f04: wiggling happily on back
f05: rolling back up, happy satisfied
```

**`shake-paw` 握手抬爪 [5帧 / once]**
```
f00: sitting, attentive
f01: lifting right front paw up
f02: paw extended forward for a handshake, proud smile
f03: paw shaking up-down, eyes bright
f04: paw lowering, pleased
```

**`chase-tail` 追尾巴转圈 [8帧 / once]** — 原地团团转追自己尾巴
```
f00: noticing tail, head turning back
f01: starting to spin, body curving
f02: 1/4 around, chasing
f03: 1/2 around (back to camera), spinning
f04: 3/4 around
f05: full circle, dizzy starting
f06: stumbling, dizzy spiral eyes
f07: sitting down dizzy, little stars
```

**`eat` 吃饭 [6帧 / loop]** — 面前一个小狗碗，低头吃
```
f00: sitting in front of a small dog bowl, head up, about to eat
f01: lowering head toward the bowl
f02: head down in bowl, eating, cheeks puffing
f03: chewing with full cheeks, one kibble near mouth
f04: head up mid-chew, happy eyes
f05: licking lips, then leaning back down (loops)
(碗是唯一允许的道具，紧贴角色脚前，仍透明背景)
```

**`sleep` 睡觉 Zzz [6帧 / loop]** — 趴下闭眼睡，飘 Zzz
```
f00: curled up lying down, eyes closed, peaceful
f01: slow breathing in, body rising slightly, small "z" appears
f02: breathing peak, "Z" floating up
f03: breathing out, "zZ" bubbles drifting
f04: deep sleep, tiny snore bubble at nose
f05: snore bubble pops, back to rest (loops)
```

**`bath` 洗澡泡泡 [6帧 / loop]** — 坐在泡泡里搓澡，头顶泡沫
```
f00: sitting with soap foam on head and back, happy
f01: rubbing with paws, bubbles floating around
f02: more bubbles, foam mohawk on head, blissful eyes closed
f03: scrubbing, bubbles popping, tongue out happy
f04: covered in suds, content
f05: bubbles drifting up (loops)
(允许泡泡/泡沫围绕身体，背景仍透明)
```

**`hungry` 饿了·盯肚子 [5帧 / once]** — 摸着肚子可怜巴巴
```
f00: standing, tummy rumble, looking down at belly
f01: paw on belly, sad hungry eyes
f02: looking up at you pleading, empty-bowl thought bubble or "..." 
f03: tummy growl mark, drooping ears
f04: licking lips hungrily, begging eyes
```

**`dirty` 脏了·挠痒 [6帧 / loop]** — 身上有泥点污渍，用后腿挠痒
```
f00: standing with visible dirt smudges/mud spots on fur, uncomfortable
f01: lifting hind leg to scratch neck
f02: scratching fast, eyes squeezed, little dust puff
f03: scratching other spot, tongue out
f04: shaking off a bit, dirt flecks
f05: still itchy, scratching (loops)
(可见泥点/污渍是关键，区别于干净版)
```

**`sick` 生病·虚弱 [5帧 / loop]** — 蔫蔫的，头顶冰袋或脸发青，体温计
```
f00: lying weakly, droopy ears, an ice bag on head, thermometer in mouth
f01: weak breathing, pale/greenish tint on face, dizzy
f02: small cough, sad sick eyes
f03: sniffling, tiny "+" health cross floating sadly
f04: weakly looking up, pleading to be healed (loops)
```

### —— Tier 2 扩展 ——

**`work-construction` 搬砖/泥瓦匠 [6帧 / loop]** — 戴小安全帽搬砖
```
f00: wearing a tiny yellow hard hat, holding a small brick, determined
f01: lifting the brick up
f02: carrying brick, walking step
f03: placing/stacking the brick down
f04: wiping brow, proud
f05: picking up next brick (loops)
```

**`work-cook` 厨师颠勺 [6帧 / loop]** — 戴厨师帽颠炒锅
```
f00: wearing a white chef hat, holding a small frying pan, smiling
f01: tossing pan, food flipping up
f02: food airborne above pan, focused happy
f03: catching food back in pan
f04: tasting with a tiny spoon, delighted
f05: ready to toss again (loops)
```

**`work-guard` 保安/警察站岗 [5帧 / loop]** — 戴警帽敬礼站岗
```
f00: wearing a small police/guard cap, standing at attention, serious-cute
f01: raising paw in a salute
f02: holding salute, proud puffed chest
f03: lowering paw, looking left alert
f04: looking right alert, on duty (loops)
```

**`work-art` 画画/漫画家 [6帧 / loop]** — 趴在小桌前画画
```
f00: at a tiny desk with paper, holding a pencil in paw, thinking
f01: drawing a stroke, focused
f02: drawing fast, tongue out concentrating
f03: pausing to look at the drawing, proud
f04: adding a detail, sparkle in eye
f05: holding up the finished doodle happily (loops)
```

**`study` 学习看书 [6帧 / loop]** — 戴小眼镜看书
```
f00: sitting with an open book, tiny round glasses, focused
f01: reading, eyes scanning, paw turning page
f02: nodding in understanding, lightbulb idea above head
f03: looking up thinking
f04: back to reading, diligent
f05: page turn (loops)
```

**`work-done` 下班数钱 [6帧 / once]**
```
f00: tired but happy, sweat drop, taking off hard hat
f01: a small bag of gold coins appears
f02: opening the bag, eyes turning into gold coins/sparkle
f03: happily counting coins in paws
f04: hugging the coin bag, delighted
f05: triumphant pose with coin bag, tail wag
```

**`play-ball` 玩球/扑球 [6帧 / once]**
```
f00: spotting a small ball, crouching ready
f01: pouncing toward the ball, front paws out
f02: airborne pounce over the ball
f03: catching/pinning the ball with paws, excited
f04: holding ball in mouth, proud
f05: dropping ball, happy bark
```

**`play-frisbee` 跳起接飞盘 [6帧 / once]**
```
f00: looking up at a small flying disc, tracking it
f01: crouching to jump
f02: leaping up high, reaching
f03: peak jump, mouth open catching the disc midair
f04: disc caught in mouth, airborne triumphant
f05: landing with disc, proud wag
```

**`jump-rope` 跳绳 [6帧 / loop]**
```
f00: holding a small jump rope handles, rope behind
f01: swinging rope overhead
f02: rope coming down front, starting hop
f03: jumping as rope passes under feet, airborne
f04: landing as rope goes back up
f05: rope overhead again (loops)
```

**`coin-get` 获得金币·开心 [5帧 / once]**
```
f00: looking up surprised happy
f01: gold coins raining down, reaching up
f02: catching coins, eyes turned to sparkles/coins, big smile
f03: hugging a pile of coins, blissful
f04: tossing a coin up playfully, joyful
```

**`levelup` 升级·闪光 [6帧 / once]**
```
f00: standing, a glow starting at feet
f01: golden light rising up the body, surprised happy
f02: burst of light, arms up, "LEVEL UP" sparkle (no readable text, just sparkle/star)
f03: surrounded by stars and confetti, triumphant pose
f04: spinning happily in the glow
f05: striking a proud hero pose, sparkle
```

**`shopping` 逛街拎袋 [6帧 / once]**
```
f00: walking happily holding small shopping bags in mouth/paws
f01: mid step, bags swinging
f02: looking into a bag excited
f03: pulling a small toy out of bag, delighted
f04: hugging the purchases
f05: walking off happy with bags
```

**`drink` 喝水 [5帧 / once]**
```
f00: approaching a small water bowl
f01: lowering head to the bowl
f02: lapping water, tongue out, ripples
f03: more laps, content
f04: head up, water drop on chin, refreshed
```

**`brush` 被梳毛舒服 [5帧 / once]**
```
f00: sitting, a small grooming brush near fur
f01: being brushed on back, fur fluffing, pleased
f02: eyes closed in bliss, sparkles on clean fur
f03: brushed on head, beard fluffing up
f04: shiny fluffy clean, proud happy
```

**`wake` 起床伸懒腰 [6帧 / once]**
```
f00: lying down eyes just opening, sleepy
f01: lifting head, yawning start
f02: big yawn, mouth wide, stretching front legs forward
f03: full stretch, downward-dog stretch pose
f04: standing up, shaking head awake
f05: alert and fresh, small smile
```

**`bath-shake` 洗完甩水 [6帧 / once]**
```
f00: wet fur flattened, standing
f01: starting to shake, body twisting left
f02: shaking hard, water droplets flying off, blur of motion
f03: shaking right, more droplets
f04: fur fluffing back up, half dry
f05: fully fluffy and dry, proud shiny
```

**`eat-full` 吃饱满足·拍肚 [5帧 / once]**
```
f00: round full belly, content smile
f01: patting belly with paw, satisfied
f02: happy burp, tiny "~", blissful
f03: rubbing full tummy, eyes closed smiling
f04: sleepy satisfied, leaning back
```

**`dizzy` 头晕转圈眼 [5帧 / loop]**
```
f00: standing wobbly, spiral eyes, swaying
f01: leaning left, dizzy stars circling head
f02: leaning right, tongue lolling, woozy
f03: stumbling, spiral eyes
f04: wobbling in place (loops)
```

**`yawn` 打哈欠困了 [5帧 / once]**
```
f00: drowsy, eyes half open
f01: mouth opening to yawn
f02: huge yawn, eyes watering, tongue curled
f03: closing mouth, rubbing eye with paw
f04: sleepy droopy, about to nap
```

**`excited` 兴奋原地转 [6帧 / once]**
```
f00: super excited, bouncing in place
f01: spinning start, joyful
f02: mid spin, ears flying
f03: spinning fast, motion lines, big grin
f04: slowing, dizzy-happy
f05: stop, triumphant happy pose, tongue out
```

### —— Tier 3 情感彩蛋（概念级，Codex 按同规范补帧）——

> 这层先给概念，Codex 参照 Tier 1/2 的写法把每帧拆出来即可。

```
goodbye   依依不舍：挥爪告别 → 落寞回头 → 小手帕擦眼 → 慢慢转身离开
cry       大哭：瘪嘴 → 泪水涌出 → 哇哇大哭喷泪 → 抽泣（loop）
surprised 惊讶：一愣 → 瞳孔放大 → 吓得跳起来毛炸 → 落地捂胸
shy       害羞：脸红 → 扭捏 → 双爪捂脸偷看 → 害羞低头
bored     无聊：发呆 → 趴下托腮 → 吹口哨/打转眼 → 叹气（loop）
think     思考：歪头 → 抬爪托下巴 → 头顶问号/灯泡 → 恍然大悟
peek      探头：从画面边缘只露半个头 → 探出一只眼 → 好奇张望 → 缩回
travel    旅游：背上小背包 → 戴帽挥手 → 拉小行李箱 → 蹦跶出发
celebrate 庆祝：戴派对帽 → 撒彩带 → 跳跃欢呼 → 撒花庆祝
recover   康复：摘掉冰袋 → 脸色转红润 → 活力伸展 → 健康满血开心
scared    害怕：缩成一团发抖 → 牙齿打颤 → 小心翼翼张望（loop）
wink      卖萌：正脸 → 单眼眨 → 抛媚眼比心 → 吐舌卖萌
dance     跳舞：8 帧律动，左右摇摆+转圈+抬爪，俏皮（loop）
beg       讨食：坐下 → 抬起双前爪作揖 → 摇尾巴期待 → 歪头卖萌（loop）
sneeze    打喷嚏：皱鼻 → 仰头蓄力 → "啊嚏"喷出 → 吸鼻子擦脸
```

---

## 8. 合成精灵图 & 接回代码

### 8.1 两种接入方式（二选一，推荐 A）

- **A · 逐帧 PNG 直接播放（推荐）**：渲染层用 `<img>` 或预加载的 Image 数组，按帧切换 `src`。无需合成精灵图，最简单，且每帧独立 512×512 最清晰。
- **B · 合成精灵图**：写个 Node 脚本把每个动作的帧横向拼成一行、所有动作纵向叠成大图，输出 `assets/sprite.webp` + 一份 `manifest.json`（每个动作的 row/frames/fps/loop），渲染层沿用现在的 `backgroundPosition` 方案。

> 当前代码用的是方式 B（单张大图 + row/frame）。素材重做后建议切到方式 A，省掉拼图、避免对齐误差。切换由我或 Codex 在 v0.2 改 `renderer.js` 完成。

### 8.2 帧清单 → 代码配置

每个动作的 `frames/fps/loop` 直接取 §6 表。例如方式 A 的配置长这样：
```js
const ANIM = {
  idle:  { frames: 6, fps: 4,  loop: true  },
  walk:  { frames: 6, fps: 8,  loop: true  },
  eat:   { frames: 6, fps: 8,  loop: true  },
  greet: { frames: 6, fps: 7,  loop: false },
  // ... 按 §6 全表
};
// 帧图路径： assets/anim/<id>/frame_<NN>.png
```

### 8.3 运动靠代码补足（降低出图难度）

不必每个位移动作都画满帧。约定：
- `walk`/`run` 的水平位移、`drag` 的悬挂摆动、`happy` 的起跳高度 → 由代码做 `transform: translate`。
- 轻微上下呼吸感 → 代码 `translateY` 正弦波叠加，省得逐帧画。
- "左"朝向 → `transform: scaleX(-1)` 镜像，**不单独出图**。

---

## 9. 验收标准

每个动作入库前自检：
1. ✅ 512×512、透明背景、无多余背景/地面阴影。
2. ✅ 一眼能认出是 §2 那只狗（毛色/眉毛/胡子/蓝马甲/粉项圈齐全）。
3. ✅ 同组所有帧：角色大小、中心、脚底基线一致，连续播放不"跳"、不"缩放抖动"。
4. ✅ 白色模切描边粗细稳定，无逐帧闪烁。
5. ✅ 姿态能讲清动作语义（不看文字也知道在吃/在洗/在生气）。
6. ✅ 表情可爱、不恐怖、无多腿/畸形。

建议先做 **`idle` + `eat`** 两组做"风格基线"，人工确认风格和一致性达标后，再批量推进其余 55 个。

---

## 10. 附录：QQ 宠物参考要点（设计依据）

- **四大数值**：饥饿、清洁各 **-2/分钟**（约 6h 需喂、3h 需洗）；心情靠互动/玩耍提升；健康过低会**生病甚至死亡**。→ 对应我们的 `eat`/`bath`/`play`/`sick` 系列。
- **桌面经典行为**：上线**热情打招呼**、下线**依依不舍告别**、待机**俏皮小动作**吸引注意、**饿了/脏了在桌面做提示动作**。→ `greet`/`goodbye`/`idle`/`hungry`/`dirty`。
- **打工赚元宝**：20+ 工种（搬砖、泥瓦匠、厨师、保安、警察、漫画家、歌手、建筑师…）随等级解锁，每天上限 8h。→ `work-*` 系列先做 4 种代表。
- **学习/小游戏/旅游**：学习提升打工能力；小游戏有弹力球、躲老鼠、跳绳、猜动作；5 级解锁旅游（心情 +5/分钟）。→ `study`/`play-ball`/`jump-rope`/`travel`。
- **成长**：蛋 → 幼年(≤9级) → 成年，15 级定型；心情越高成长越快。→ 体型/外观可作为 v2 的成长表现（本期暂不做多体型素材）。

**资料来源**：
- [QQ宠物_百度百科](https://baike.baidu.com/item/QQ%E5%AE%A0%E7%89%A9/204567)
- [QQ宠物怎么玩-百度经验](https://jingyan.baidu.com/article/a3aad71afb6a99b1fb009600.html)
- [QQ宠物打工学习对照表-CSDN](https://blog.csdn.net/ysuncn/article/details/2920171)
- [死亡五年的电子宠物，治好了现代打工人的精神内耗-TapTap](https://www.taptap.cn/moment/477547301213048638)
- [“复活”的QQ宠物，回不来的情怀-腾讯新闻](https://news.qq.com/rain/a/20211115A0FZJ100)
