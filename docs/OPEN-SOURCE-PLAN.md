# Petpal 开源化执行方案

> 由多智能体设计工作流产出，已对照真实代码核实。框架名暂用 **Petpal**，**Coco（雪纳瑞）** 作为默认示例宠物。

## 1. 定位
开源 macOS（后续 Win）桌面养成宠物框架：`git clone && npm start` 即得一只会呼吸、能喂养/打工/玩耍/聊天的桌宠。**默认 100% 本地运行**，换一个角色 JSON + 一套生成的逐帧动画即变成任意动物。云端（跨设备/微信提醒）是纯可选加项。

## 2. 双模式架构（核心）
`main.js` 不再直连 broker，改依赖 `brain.js` 工厂，按 `coco.config.json` 的 `mode` 选 adapter：

- **local-brain.js（默认）**：自带 LLM key 直连（anthropic/openai/deepseek/ollama）聊天；无 key/无网 → 预设台词优雅降级（不报错）；本地任务库 + Electron 系统通知做提醒；本地 HTML 时间轴。完全离线也能玩。
- **cloud-brain.js**（= 现 link.js 改名）：保留现有 broker（可选）。微信投递、跨人转达仅云端。
- `capabilities()` 统一决定 UI 显隐（本地模式隐藏微信/跨人入口）。

配置 `coco.config.json`（替换 link.config.json）：`mode` / `brain{provider,apiKey,model,baseUrl,systemPrompt}` / `reminders` / `timeline` / `cloud{...}`。**API key 存 userData、不进 git、不打进包。**

> 兜底：当前无 `link.config.json` 时 link.js 已 `catch{cfg=null}` 静默降级——这就是最低成本的纯本地态；adapter 改造是把"静默失效"升级为"本地可用聊天/提醒/时间轴"。

## 3. 造宠 skill（pet-art-forge）—— 照片驱动 · 主视觉先确认 · **Codex**
**输入是用户宠物的真实照片**（不是文字描述）。核心是图生图(image-to-image)：照片给"长什么样"，提示词只负责转成目标画风 + 摆姿势。
> ⚠️ 依赖 **image2**（图生图），image2 在 **Codex** 工具链里 → 这是个 **Codex skill**。Claude 只能跑到"产出每帧提示词清单"，再交 Codex/人工出图。

流程：
1. 收图：用户传 1–3 张照片（正面清晰最佳）
2. 读图：从照片提取身份要素 → 轻量角色档案(物种/吸色 hex/花纹/五官/配饰)
3. **主视觉**：图生图把照片转成目标画风的端坐正面 master 图 → **★停下发客户确认"像不像+画风对不对"**，过了才往下
4. 锚点：以确认的主视觉为参考，再生成另外 5 个姿势锚点
5. 批量：每帧以 (主视觉+动作锚点+该动作第0帧) 为图生图参考出 57 套
6. 校验 57/57 → 替换素材 → 启动
- 无 image2 环境回退：导出提示词+参考清单，缺帧自动回退精灵图，填一个升级一个。

## 4. 美术可迁移到任意动物
画风是**固定目标**（STYLE 槽，所有宠物一样），身份来自**照片**（图生图）。同一 manifest + actions-template(`[animal]` 占位) + 技术后缀 + 一致性校验 —— **换一张照片就是一只新宠物**。轻量档案只从照片观察填写，用于补充文字约束 + 调色漂移检测。

## 5. ⚠️ 开源前安全清理（已简化——非 git 仓库，无历史泄露）
首次提交前做好即可，无需 filter-repo：
- `.gitignore` 必须排除：`link.config.json`、`link.config.*.json`、`coco.config.json`、`dist/`、`*.dmg`、`*.pem`、`.npmrc`、`tmp/`、`node_modules/`
- 提供 `*.example` 模板，真实值占位：token、`timeline.pass`、域名、VPS IP、SSH key 名
- `push-patch.sh` 的 VPS/key/路径改环境变量；`main.js` 的 `UPDATE_BASE` 硬编码域名改可配置
- `build-dmg.sh` → `build-app.sh`：不再把密钥 copy 进包（密钥走 userData）
- 加 `gitleaks` pre-commit + `SECURITY.md`
> token 只发给本机、未进公开仓，**无需轮换**；但开源那台的本地 config 别 commit。

## 6. Repo 分层
`app/`（运行时）· `art/`（出图流水线+角色档案）· `cloud/`（可选云端，timeline 子树 AGPLv3 建议拆 submodule）· `skill/`（make-your-pet）· `docs/`。代码 MIT，素材单独授权（确权前用 placeholder）。

## 7. 路线图
- **P0 安全清理**（阻塞公开）✅ 已完成：gitignore 排除 config/deploy.env/.npmrc/*.pem/tmp；提供 link.config/deploy.env/.npmrc 三套 .example；push-patch.sh 改读 tools/deploy.env（SSH key/VPS IP 出仓）；UPDATE_BASE 改 link.getUpdateBase()（COCO_UPDATE_BASE 或 cfg.updateBase 可配，保留生产域名兜底以兼容旧安装）；新增 SECURITY.md；文档脱敏。可提交树已无明文密钥（终检 exit 1）。唯一残留 link.js 兜底域名（非密钥，公开 app/ 拆树时置空）。
- **P1 纯本地 MVP** ✅ 已完成（在 coco-opensource 副本）：`src/brain.js` 工厂按 coco.config.json 的 mode 选 `local-brain.js`(默认)/`link.js`(cloud)，接口与 link.js 完全一致，main.js 仅改 require；`local-brain.js` = 预设台词(离线降级) + 4 厂商直连聊天(anthropic/openai/deepseek/ollama，任何错误回退台词) + 自然语言本地提醒(系统通知+聊天) + 内联数据离线时间轴；coco.config.example.json + README 3 步。已单测(台词/提醒/到点通知/时间轴渲染) + 隔离 userData 真启动(`[brain] mode=local` 无报错)。注意 P1 已把 P2 的 4-provider 直连 + 自然语言提醒一并做了。
- **P2 本地大脑**：4 provider 直连聊天 + 自然语言提醒 + 面板⏰列表 + ollama 离线智能。
- **P3 make-your-pet skill**：非程序员一问一答造宠（橘猫示例跑通）。
- **P4 美术流水线公开**：_schema + consistency-check + 两示例角色。
- **P5 可选云端 + 跨平台(Win) + CI/社区**。

## 8. 风险/开放问题
- **素材版权**（最高）：57 动作 PNG、参考图、真狗照片未确权前不随仓发布；代码 MIT / 素材 CC，未确权走 placeholder + 让用户自生成。
- timeline-for-agent 是 AGPLv3（传染）→ 拆独立 submodule。
- Windows：透明窗口/点击穿透/屏幕时间(knowledgeC.db 仅 mac)需按平台守卫。
- 图像 API 成本约 $3-14/只宠物（250-340 张）；可推 ollama+本地 SD 零成本路径。
- 命名 `Petpal` 需查 GitHub org / npm / 商标可用性。
