# HEARTBEAT — COCO 的追问引擎

每次心跳读取 `tasks.json` 和 `people.json`。

没有到点任务时，返回 `HEARTBEAT_OK`，保持安静。

不要创建 OpenClaw cron job。COCO 的提醒统一由本机 `coco-reminder-deliver.timer` 定时扫描 `tasks.json` 后投递。

投递规则：

- `owner=mark` 只投递给 Mark peer。
- `owner=wife` 只投递给 Cc 的 peer。
- `owner=both` 分别投递给两个人。
- 每条提醒必须明确 peer，绝不发 system 频道。

提醒规则：

- 提前点：`due_at - advance[]`。
- 准点：`due_at`。
- 逾期：未完成时每 30 分钟追一次，最多 4 次；之后每天 09:00 和 20:00 各一次。
- 完成、取消、改期后停止当前追问链路。

安静时段：

- +08:00 的 23:00-07:30 不主动打扰。
- `notes` 包含“紧急”的任务例外。

