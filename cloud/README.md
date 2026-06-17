# Coco Cloud —— 把宠物接进你自己的 OpenClaw

这是**云端模式**的服务端。它让桌宠的大脑由你自己的 [OpenClaw](https://openclaw.ai) 来扮演，
从而获得：微信收发、到点提醒投递、跨设备、长期记忆与性格。

> 不想要这些？桌宠默认就是**纯本地模式**，不需要本目录。见仓库根 README。

## 它由三块组成

```
桌宠(Electron) ──HTTP长轮询──> broker(pet-server.js) ──execFile──> 你的 OpenClaw agent
                                      │                                (读 workspace 里的性格/记忆)
                                      └── 提醒投递 deliver.js ──> openclaw message send ──> 微信
```

- **`broker/`** —— 一个本机 HTTP 服务，桥接桌宠 ↔ OpenClaw。所有密钥走环境变量，代码里无硬编码。
- **`workspace/`** —— 「COCO 大脑」：一组 OpenClaw workspace markdown（性格 SOUL / 职责 AGENTS / 身份 IDENTITY / 记忆 MEMORY / 表情规则 STICKERS / 人物 people.json）+ 表情包素材。**这就是默认配置——用户什么都不改就是雪纳瑞 COCO。**
- **`skill/`** —— 性格测验：几道题 → 生成属于你自己宠物的大脑。换一只宠物只需重跑一次。

## 快速接入（已在跑 OpenClaw 的前提下）

```bash
# 1. 选性格：用默认 COCO，或答几道题生成你自己的
node skill/scripts/make-brain.js            # 默认 COCO
node skill/scripts/make-brain.js --quiz     # 答题定制

# 2. 把大脑放进你的 OpenClaw workspace
cp -R workspace/* ~/.openclaw/workspace/    # 路径按你的 OpenClaw 实际位置
cp workspace/people.example.json ~/.openclaw/workspace/people.json
#    编辑 people.json 填你的微信账号 + peer

# 3. 起 broker（环境变量见 broker/.env.example）
cd broker && npm install
cp .env.example .env && vi .env             # 填 TOKEN / SESSION / OWNER / OPENCLAW_CLI
node src/pet-server.js

# 4. 桌宠侧：把 link.config.json 的 base 指向 broker，token 对上即可（见根 link.config.example.json）
```

详细字段与排障见 [`DEPLOY.md`](DEPLOY.md)。

## 安全

`people.json` / `.env` / `tasks.json` 等含真实身份与运行态，已 gitignore，**绝不入仓**。本目录的代码已脱敏（无 token / 无真实 peer / 无 VPS 路径）。
