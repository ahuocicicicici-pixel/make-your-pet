# COCO Reminder

Local Docker scaffold for the COCO WeChat reminder assistant.

This does not connect to WeChat. It verifies the safe core:

- create tasks in `workspace/tasks.json`
- route reminders by `owner` through `workspace/people.json`
- generate mock delivery records in `workspace/deliveries.jsonl`
- stop reminders after a task is marked `done`
- fetch Xunji training records into local cache without repeated requests

## Commands

```bash
npm test
npm run add -- --creator mark --text "明天下午3点前填平台资料，提前半小时提醒" --now "2026-06-04T10:00:00+08:00"
npm run heartbeat -- --now "2026-06-05T14:30:00+08:00"
npm run complete -- --creator mark --text "搞定平台资料了"
node src/cli.js trains --datestr "2026-04-02"
```

For Xunji training data, provide the key through `XUNJI_API_KEY` or put it in `workspace/secrets/xunji-api-key`.
You can also use owner-specific key files such as `workspace/secrets/xunji-api-key-mark` and `workspace/secrets/xunji-api-key-wife`.
The response is cached at `workspace/cache/xunji/trains/<owner>/YYYY-MM-DD.json`; if the file exists, COCO reads it and does not request the API again.

Docker:

```bash
docker compose build
docker compose run --rm app node src/cli.js heartbeat --now "2026-06-05T14:30:00+08:00"
```

The production OpenClaw workspace should copy the files under `workspace/`, then replace mock peers in `people.json` after WeChat binding.
