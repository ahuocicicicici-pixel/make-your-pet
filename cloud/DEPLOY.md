# 部署到你自己的 OpenClaw

完整把 Coco 云端大脑接进自有 OpenClaw 的步骤与排障。

## 前置

- 一台能跑 OpenClaw 的机器（VPS 或本机），OpenClaw 已绑定微信、`openclaw` CLI 可用。
- Node ≥ 22。

## 步骤

### 1. 生成大脑（性格）
```bash
cd cloud
node skill/scripts/make-brain.js --quiz        # 或不加 --quiz 用默认 COCO
```

### 2. 装进 OpenClaw workspace
```bash
cp -R workspace/* ~/.openclaw/workspace/       # 你的 workspace 实际路径
cp workspace/people.example.json ~/.openclaw/workspace/people.json
```
编辑 `people.json`：每个主人填 `account`（OpenClaw 微信 bot 账号）与 `peer`（对方的 wechat peer id）。`owner` 的 key 任意，但要和 broker 的 `COCO_PET_OWNER` 对上。

### 3. 起 broker
```bash
cd broker && npm install
cp .env.example .env          # 填 COCO_PET_TOKEN / OPENCLAW_CLI / COCO_WORKSPACE / COCO_PET_OWNER
node --env-file=.env src/pet-server.js
```
看到 `coco pet broker on 127.0.0.1:18790` 即成功。生产建议用 systemd/pm2 守护，并用反向代理（Caddy/Nginx）加 TLS 暴露 `/coco/pet/*`。

### 4. 定时提醒（可选）
提醒由 broker 内部巡 `tasks.json` 推送；微信侧投递用 `deliver.js`。可挂一个定时器：
```bash
node --env-file=.env src/cli.js deliver        # 每分钟跑一次(systemd timer / cron)
```

### 5. 桌宠侧指向 broker
仓库根 `link.config.json`（模板 `link.config.example.json`）：
```json
{ "mode": "cloud", "base": "https://你的域名/coco/pet", "token": "和 .env 里 COCO_PET_TOKEN 一致", "owner": "owner1" }
```

## 关键环境变量（broker/.env）

| 变量 | 必填 | 说明 |
|---|---|---|
| `COCO_PET_TOKEN` | ✓ | 桌宠↔broker 鉴权，与桌宠 link.config token 一致 |
| `OPENCLAW_CLI` | ✓ | openclaw 的 `dist/index.js`，broker 靠它跑 agent 回话 |
| `COCO_WORKSPACE` | ✓ | 放了大脑 markdown + people.json 的 workspace |
| `COCO_PET_OWNER` | ✓ | 本 broker 服务谁（people.json 的 key） |
| `COCO_PET_SESSION` | | OpenClaw 会话 key，每个宠物/人用不同的 |
| `OPENCLAW_BIN` / `OPENCLAW_WEIXIN_ACCOUNT` | | 提醒投递用 |
| `COCO_PEER_*` | | 双人互相转达（各起一个 broker） |
| `COCO_TL_*` | | 生活时间轴（可选，独立项目） |

## 排障

- **桌宠说"不在线" / 收不到回复**：broker 没起 / token 不一致 / `OPENCLAW_CLI` 未设（broker 日志会打 `OPENCLAW_CLI not set`）。
- **提醒不发微信**：检查 `people.json` 的 peer 是否正确、`OPENCLAW_BIN` 能否 `message send`、任务 `status=active` 且 `owner` 对上。
- **图片发不出(Media failed)**：发图太频繁被微信限流——`STICKERS.md` 已规定别每条都发，保持低频。
- **双人串台**：每人一个独立 broker（不同端口 + 不同 SESSION + 不同 OWNER + 不同 token），队列不共享。

## 双人部署拓扑

```
owner1: broker :18790  SESSION=...:pet-1  OWNER=owner1  ─┐
                                                          ├─ 同一 OpenClaw / workspace
owner2: broker :18791  SESSION=...:pet-2  OWNER=owner2  ─┘   (people.json 两人都在)
两个 broker 用 COCO_PEER_* 互指，可实现"帮我跟 TA 说一声"。
```
