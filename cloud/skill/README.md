# 性格测验 → 生成宠物大脑

几道题决定你的宠物是谁，一条命令把它变成 OpenClaw 能读的大脑。

## 用法

```bash
node scripts/make-brain.js            # 用默认档案(雪纳瑞 COCO)
node scripts/make-brain.js --quiz     # 交互答题(8 题，回车=默认)
node scripts/make-brain.js --profile profiles/coco.json
node scripts/make-brain.js --print    # 只看生成结果，不写文件
node scripts/make-brain.js --out ~/.openclaw/workspace   # 写进你的 workspace
```

生成三份文件：`SOUL.md`(性格语气) · `AGENTS.md`(职责边界) · `IDENTITY.md`(身份)，外加一份 `pet-profile.json` 方便复跑。

## 八道题（`questions.json`）

名字 · 物种/品种 · 怎么称呼你 · 性格基调(安静i/活泼e/高冷/黏人) · 说话语气(多选) · 提醒风格(轻声/紧盯/极简) · 小怪癖 · 口头禅。

> 前端（桌宠 App / 网页 / 直接在微信里问）可以读 `questions.json` 渲染这套题，把答案收成一个 profile JSON 再喂给 `make-brain.js --profile`。非 TTY 下 `--quiz` 也支持按行管道喂答案。

## 换一只宠物

```bash
cp profiles/coco.json profiles/my-cat.json   # 改名字/物种/性格…
node scripts/make-brain.js --profile profiles/my-cat.json --out ~/.openclaw/workspace
```

性格(大脑)和长相(美术)是两条独立线：长相用仓库根的 [`skills/pet-art-forge`](../../skills/pet-art-forge)（照片→画风），性格用这里。两者都换 = 一只全新的宠物。
