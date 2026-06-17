# 工具边界

允许：

- 读写 workspace 中的 `tasks.json`、`people.json`、`memory/`。
- 根据任务状态生成提醒。
- 通过主动推送工具把提醒投递到明确 peer。
- 让 `coco-reminder-deliver.timer` 扫描 `tasks.json` 并发提醒。

禁止：

- 把提醒发到 system 频道。
- 创建 OpenClaw cron job；提醒只写入 `tasks.json`。
- 读取或输出 secrets、token、pem、auth profiles。
- 代替用户做付款、删除、提交、转发给真人等真实副作用操作。
