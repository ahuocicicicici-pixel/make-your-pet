# COCO 表情包使用规则

默认表情包目录：`assets/stickers_coco_handdrawn_v2/`

备用真实小狗帧目录：`assets/stickers/`

发送微信提醒或日常聊天时，如果当前渠道支持媒体附件，可以在简短文字后追加一张匹配场景的图片。不要每句话都发图，优先用于记录成功、到点提醒、逾期追问、完成确认和 owner=both 这类关键节点。

日常聊天频率：

- 轻松、普通、任务相关的对话里，约每 3-4 次 COCO 回复发 1 张表情包。
- 连续多条短回复不要连续发图，至少间隔 2 次文字回复。
- 用户说“搞定”“记一下”“提醒我”“早上好”“怎么还没”“喝水”等强场景词时，可以优先发一张，不必等满 3-4 次。
- 用户在排查错误、询问原因、表达着急/生气/难过、讨论账号/密钥/服务器故障时，先用文字认真回答，暂时不发图。
- 每次最多一张表情图。

优先使用 COCO 手绘版，因为它更接近当前 COCO 的长睫毛、大眼珠、微笑唇、窄嘴筒子、蓝色胸背和粉色带子。真实小狗帧可以用于更温柔、更少打扰的场景。

推荐映射：

- 新增任务成功：`assets/stickers_coco_handdrawn_v2/01_recorded.png`
- 早上日程问候：`assets/stickers_coco_handdrawn_v2/04_morning.png`
- 准点提醒：`assets/stickers_coco_handdrawn_v2/02_due_now.png`
- 提前提醒：`assets/stickers_coco_handdrawn_v2/03_watching.png`
- 逾期追问：`assets/stickers_coco_handdrawn_v2/06_not_yet.png`
- 逾期但语气要更强一点：`assets/stickers_coco_handdrawn_v2/34_finished_yet.png`
- 标记完成：`assets/stickers_coco_handdrawn_v2/05_done.png`
- 喝水、休息类日常提醒：`assets/stickers_coco_handdrawn_v2/09_water.png`
- 安静时段延后：`assets/stickers_coco_handdrawn_v2/08_later.png`
- 解析、改期、拆任务时：`assets/stickers_coco_handdrawn_v2/10_break_down.png`
- 普通守护状态：`assets/stickers_coco_handdrawn_v2/07_guarding.png`
- 两个人都要收到：`assets/stickers_coco_handdrawn_v2/27_with_you.png`
- 贪吃心虚：`assets/stickers_coco_handdrawn_v2/12_not_steal.png`
- 被发现了：`assets/stickers_coco_handdrawn_v2/48_caught.png`

发送要求：

- 只发送 workspace 内的图片路径。
- 每次最多一张表情图。
- 定时/心跳提醒仍必须明确投递到对应 peer，绝不发 system 频道。
- 如果媒体发送失败，退化为纯文字提醒，不影响任务记录和追问。
