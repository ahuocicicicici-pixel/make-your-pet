---
name: local-desktop-pet
description: >
  帮用户在自己的 Mac 上搭起一只【纯本地】桌面养成宠物——无需任何服务器（不用 OpenClaw、不用 VPS）。
  开箱即跑：透明桌宠 + 57 动作动画；借 LLM 聊天（DeepSeek/OpenAI/Anthropic/Ollama，没填 key 自动回退可爱台词，
  也能用 Ollama 完全离线）；本地提醒（自然语言「提醒我18:00喝水」→ macOS 系统通知）；首次打开弹性格测验定人设。
  适用于"帮我做一只桌面宠物"、"在我电脑上装个能聊天会提醒的桌宠"、"把这只宠物变成我家猫/狗的样子"。
  在 Codex 里运行最顺：换造型那步用到图生图（image2，见 pet-art-forge skill）。
---

# Local Desktop Pet（纯本地桌面宠物 · 一条龙搭建）

把这个仓库变成一只跑在用户 Mac 桌面上的宠物。**全程本地**：聊天借 LLM、提醒用系统通知、数据存本机，
不需要后端、不需要联网（配 Ollama 时连模型都在本地）。`cloud/` 目录是想接微信的高级用户才用，本 skill 完全忽略它。

> **平台：Codex 最顺**（第 5 步换造型用到 image2 图生图）。前 4 步在任何环境都能做。

## 何时用
- "帮我在 Mac 上搭一只桌面宠物。"
- "我要一只能聊天、会提醒我的桌宠，不要装服务器。"
- "把默认的雪纳瑞换成我家这只猫/狗。"

## 产出
- 一个能 `npm start` 跑起来的本地桌宠（默认雪纳瑞 Coco）
- `coco.config.json`（用户的性格 + 可选 LLM key，写在 userData，不入仓）
- （可选）用户宠物照片生成的全套 57 动作动画，替换默认形象

---

## 总流程

```
1. 跑起来   npm install && npm start         → 桌面立刻有一只 Coco（零配置）
2. 定性格   首次启动自动弹性格测验(7题)        → 写 coco.config.json 的 systemPrompt
3. 接 LLM   coco.config.json 填一个 key       → 真·智能聊天（Ollama 可全离线）
4. 用提醒   聊天里说「提醒我 HH:MM 做X」        → 到点弹系统通知（已内置）
5. 换造型   (可选) 用户宠物照片 → pet-art-forge → 替换 57 动作动画
```

第 1 步做完就已经有一只能玩的宠物了；2-5 按需推进。

---

## 步骤详解

### 1. 跑起来（零配置）
```bash
npm install
npm start
```
桌面出现 Coco（雪纳瑞，57 动作动画）。拖动移动、悬停出按钮、点击互动、聊天框可输入。
此时聊天用内置台词（离线也能逗），提醒已可用。

### 2. 定性格（首次自动弹窗，零命令）
第一次 `npm start` 会自动弹「认识一下你的宠物」向导，7 道题：
名字 / 物种 / 怎么称呼你 / 性格(安静i·活泼e·高冷·黏人) / 语气 / 小怪癖 / 口头禅。
点「生成我的宠物」即时生效；点「跳过」用默认 Coco 且不再打扰。
- 写入 `userData/coco.config.json` 的 `brain.systemPrompt`；离线台词也按口头禅替换（猫说「喵」）。
- Codex/前端可不走 GUI：读 `src/personality.questions.json` 渲染题 → `node scripts/make-personality.js --profile 答案.json`，或 `npm run personality` 交互答。

### 3. 接 LLM（可选，推荐）
```bash
cp coco.config.example.json coco.config.json     # 若第2步已生成则直接编辑它
```
```jsonc
"brain": {
  "provider": "deepseek",        // anthropic | openai | deepseek | ollama
  "apiKey": "用户的key",
  "model": "deepseek-chat"
}
```
- 完全离线又要智能 → `provider:"ollama"`、`baseUrl:"http://localhost:11434"`、`model:"llama3"`，无 key 无网。
- 不填 key 自动回退台词，不报错。key 只存本机、已 gitignore。
- 实现见 `src/local-brain.js`（聊天出错自动回退台词），只配 JSON，不改代码。

### 4. 本地提醒（已内置）
聊天里说：`提醒我 18:00 喝水` / `提醒我 30分钟后 起来走走` / `/提醒 23:30 睡觉`。
支持 HH:MM、N分钟后、N小时后；过点顺延次日；到点弹 macOS 通知 + 宠物提醒。数据存本机。

### 5. 换成用户自己的宠物（可选）
用用户宠物照片转成同款画风、生成全套 57 动作，替换默认 Coco。
→ 转交 [`pet-art-forge`](../pet-art-forge/SKILL.md) skill（图生图，Codex 强项）：
收照片 → 出主视觉让用户确认像不像 → 批量 57 → `npm run check:assets` 校验 57/57 → 重启换脸。

---

## 验收

| 检查 | 期望 |
|---|---|
| `npm start` | 桌面出现宠物，可拖动、可点 |
| 首次启动 | 自动弹性格测验；答完或跳过后 `coco.config.json` 就绪 |
| 聊天 | 有 key→智能回复；无 key→台词（且带设定的口头禅） |
| 说「提醒我 1分钟后 测试」 | 1 分钟后弹系统通知 |
| （第5步后）`npm run check:assets` | 57/57，退出码 0 |

全部通过 = 一只**纯本地、有性格、会聊天、会提醒**的桌宠就成了。打包成 App：`npm run dist:mac`。

## 注意
- 这是**纯本地** skill：不要引入 `cloud/`、OpenClaw、VPS、微信。
- key/`coco.config.json`/提醒数据都在用户本机，绝不上传、绝不入仓。
- 性格(systemPrompt) 与造型(美术) 是两条独立线，各换各的。
