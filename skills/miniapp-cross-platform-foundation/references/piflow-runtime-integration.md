# PiFlow 运行时接入说明（add-skill-lib 方案）

本文件用于将小程序官方 skill 组从“文档设计”落地到 `piflow` 真实配置。默认情况下不要求你手工改 `piflow` 仓库配置文件；应先让 `add-skill-lib` 生成基础注册与 `skill.yaml`，再按本说明完成明确启用。

## 一句话结论

这套小程序 skill 组合默认不直接变更 `piflow`，是 **catalog-only**，需要显式启用：

- `miniapp-cross-platform-foundation`
- `miniapp-platform-wechat`（微信）
- `miniapp-platform-douyin`（抖音）
- `miniapp-platform-alipay`（支付宝）
- `miniapp-quality-and-compliance`（质量/合规）

## 第一步：通过 add-skill-lib 同步技能库

在 `piflow` 根目录执行（仅示意）：

```bash
pif-skill-lib add https://github.com/rudyzhuang/piflow-skills.git \
  --library=piflow_official_repo \
  --ref=main \
  --write \
  --json
```

- 同步后，`library.path` 形如：
  - `piflow/skill-libraries/repos/piflow-skills/skills`
- 运行 `pif-skill-lib list --json`，确认以下 skill id 已发现并 catalog-only 或 disabled-by-default 暴露：
  - `miniapp-cross-platform-foundation`
  - `miniapp-platform-wechat`
  - `miniapp-platform-douyin`
  - `miniapp-platform-alipay`
  - `miniapp-quality-and-compliance`

## 第二步：在 `templates/skills-template.yaml` 中显式启用（仅在用户要求“进入流水线”时）

只当用户明确要求小程序进入 PiFlow runtime 才编辑以下配置；否则保持 catalog-only 即可。

### catalog 注入（应与 add-skill-lib 的能力发现一致）

- `miniapp-cross-platform-foundation`
- `miniapp-platform-wechat`
- `miniapp-platform-douyin`
- `miniapp-platform-alipay`
- `miniapp-quality-and-compliance`

都应从 `library: piflow_official_repo`、`path: piflow/skill-libraries/repos/piflow-skills/skills/<skill-id>` 暴露。

### codegen 单元组合

建议使用 3 套 unit（foundation 必须与单平台 skill 同时执行）：

- `miniapp_taro_wechat`:
  - `miniapp-cross-platform-foundation`
  - `miniapp-platform-wechat`
- `miniapp_taro_douyin`:
  - `miniapp-cross-platform-foundation`
  - `miniapp-platform-douyin`
- `miniapp_taro_alipay`:
  - `miniapp-cross-platform-foundation`
  - `miniapp-platform-alipay`

`unit_rules` 建议匹配项：

- `client_target=miniapp && framework=wechat-miniapp -> miniapp_taro_wechat`
- `client_target=miniapp && framework=tt -> miniapp_taro_douyin`
- `client_target=miniapp && framework=douyin-miniapp -> miniapp_taro_douyin`
- `client_target=miniapp && framework=alipay -> miniapp_taro_alipay`
- `client_target=miniapp && framework=alipay-miniapp -> miniapp_taro_alipay`
- `client_target=miniapp && framework=taro -> miniapp_taro_wechat`（默认首选 wechat 编译矩阵）

### test 单元组合

- `miniapp_quality`:
  - `miniapp-quality-and-compliance`
- `unit_rules`: `client_target=miniapp -> miniapp_quality`

## 审核与回归要求（建议）

- 检查 `library.path + locator -> <skill-dir>` 的路径映射是否成立（例如 `.../skills + miniapp-platform-wechat -> .../skills/miniapp-platform-wechat`）。
- 仅在明确授权时把 quality skill 纳入 test，避免把高风险发布动作和审核提交默认执行。
- 先用 `--dry-run` 生成预览，再写入，避免误改。
