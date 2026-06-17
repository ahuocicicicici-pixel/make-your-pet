# 安全说明 / Security

## 密钥从不入仓
真实凭据只存在于本机，全部被 `.gitignore` 排除：

| 文件 | 内容 | 模板 |
|---|---|---|
| `link.config.json` / `link.config.*.json` | 通道 token、时间轴密码、broker 域名 | `link.config.example.json` |
| `coco.config.json` | 本地大脑 API key（规划中） | `coco.config.example.json` |
| `tools/deploy.env` | VPS 主机 / SSH key 路径 / 远程目录 | `tools/deploy.env.example` |
| `*.pem` `*.key` | 私钥 | — |
| `.npmrc` | 国内镜像配置 | `.npmrc.example` |

## 首次提交前自检
```bash
# 确认没有真实密钥进入暂存区（应无输出）
git diff --cached | grep -nE "[0-9a-f]{40,}|BEGIN .*PRIVATE KEY|\.pem|[0-9]{1,3}(\.[0-9]{1,3}){3}"
```
建议装 [gitleaks](https://github.com/gitleaks/gitleaks) 做 pre-commit：
```bash
gitleaks protect --staged -v
```

## 纯本地运行不需要任何密钥
缺 `link.config.json` 时应用自动降级为离线模式（见 `src/link.js` 的 `catch{cfg=null}`）。
云端（跨设备 / 微信提醒 / 时间轴）是可选加项，需自备 VPS。

## 报告漏洞
请私下邮件联系维护者，勿在公开 issue 披露。
