# piflow-skills

面向 Cursor、Codex 和 Claude Code 的个人 Agent Skills 集合。

本仓库把多个 skill 统一放在一个代码库中，并通过根目录的统一安装器
`install.mjs` 安装或同步到本机各 Agent 的 skill 目录。可安装的 skill
都位于 `skills/<skill-name>/` 下。

英文版文档见 [README.md](./README.md)。

## 当前 Skills

| Skill | 用途 | 主要文件 |
| --- | --- | --- |
| `req-maker` | 从用户提示、文档、规格说明、截图、Figma Make `.make` 本地包或 PiFlow `req-md-export` 数据中提炼需求，生成中文 PiFlow 风格 `inputs/req.md`，并执行评审循环。 | `skills/req-maker/SKILL.md`, `skills/req-maker/assets/req-template.md`, `skills/req-maker/scripts/figma-make-summary.mjs`, `skills/req-maker/scripts/export-req-md.mjs` |
| `req-reviewer` | 评审并修订已有中文需求文档，尤其是 `inputs/req.md`，直到通过来源覆盖、质量、一致性、feature ID、多客户端契约、兼容性和可测试性检查。 | `skills/req-reviewer/SKILL.md`, `skills/req-reviewer/agents/openai.yaml` |
| `plan-doc-maker` | 在项目本地 `docs/plans/` 下生成已评审的中文方案文档，并维护去重后的 `plan_index.md` 执行索引。 | `skills/plan-doc-maker/SKILL.md`, `skills/plan-doc-maker/assets/plan-template.md`, `skills/plan-doc-maker/agents/openai.yaml` |
| `plan-executor` | 执行用户方案、源方案文档或 `docs/plans/plan_index.md` 中的修改点，完成实现、评审、验证、状态回写、提交和推送。 | `skills/plan-executor/SKILL.md`, `skills/plan-executor/agents/openai.yaml` |
| `commit-push` | 将“提交并推送”固化为可重复 Git 流程：检查变更、归纳提交意图、可选升版、commit、push，并可选创建缺失的 GitHub remote。 | `skills/commit-push/SKILL.md`, `skills/commit-push/scripts/commit_push.cjs`, `skills/commit-push/scripts/github_remote.cjs` |
| `piflow-status-inspector` | 读取当前项目 `output-stages/stages.json`，汇总 PiFlow 运行状态、stage 进度、运行时间、失败次数、recovery 次数和当前 stage 子任务完成情况。 | `skills/piflow-status-inspector/SKILL.md`, `skills/piflow-status-inspector/scripts/project_status.cjs`, `skills/piflow-status-inspector/agents/openai.yaml` |

## 支持的 Agent

安装器会检测并安装到以下用户级 skill 目录：

| Agent | 安装路径 |
| --- | --- |
| Cursor | `~/.cursor/skills/<skill-name>` |
| Codex | `~/.codex/skills/<skill-name>` |
| Claude Code | `~/.claude/skills/<skill-name>` |

默认安装方式是创建符号链接，从 Agent 的 skill 目录指回本仓库。这样本机只需要维护一份可编辑源码。移动仓库位置后，需要重新运行安装器。

安装前，如果目标位置已存在同名 skill，会先移除旧安装，再替换为当前版本。

安装前，安装器会校验每个选中的 skill。每个可安装 skill 都必须包含
`SKILL.md`、`VERSION`、`CHANGELOG.md`、`README.md`、`README.zh-CN.md`
和 `install.mjs`。

当选择 Codex 作为安装目标，且仓库中存在 `.codex-plugin/plugin.json` 时，安装器还会把本仓库作为本地 Codex plugin 安装，更新个人 marketplace 条目，并在 `codex` 命令可用时执行 `codex plugin add`。

## 安装

安装仓库中检测到的全部 skills：

```bash
node install.mjs
```

安装单个 skill：

```bash
node install.mjs req-maker
node install.mjs --skill commit-push
```

安装多个指定 skills：

```bash
node install.mjs req-maker commit-push
node install.mjs --skill req-maker --skill req-reviewer
```

预览安装动作，不写入文件：

```bash
node install.mjs --dry-run
node install.mjs req-maker --dry-run
```

只安装到某个 Agent：

```bash
node install.mjs --only codex
node install.mjs req-maker --only cursor
node install.mjs commit-push --only claude
```

只安装到多个指定 Agent：

```bash
node install.mjs req-maker --only codex --only claude
```

安装到所有已知 Agent 目录，即使没有检测到对应 Agent：

```bash
node install.mjs --all
node install.mjs req-maker --all
```

复制文件而不是创建符号链接：

```bash
node install.mjs --copy
node install.mjs req-maker --copy
```

## Skill 本地 Wrapper

每个 skill 仍然可以从自己的目录安装：

```bash
cd skills/req-maker
node install.mjs
```

这些本地安装脚本只是兼容 wrapper。共享安装逻辑只维护在仓库根目录的 `install.mjs` 中。

如果要安装所有 skills，请在仓库根目录运行：

```bash
node install.mjs --all-skills
```

## 使用

安装后，直接向 Agent 提出想执行的工作流即可。Agent 会根据 skill 描述自动选择匹配的 skill。

示例：

```text
使用 req-maker，根据这些产品想法生成 inputs/req.md，并评审到通过。
```

```text
评审 inputs/req.md，修订到通过并标记为已评审。
```

```text
生成一个认证升级技术方案，写入 docs/plans/ 并评审到通过。
```

```text
提交并推送当前改动，commit message 根据这次修改内容生成。
```

如果你的 Agent 支持显式点名 skill，也可以这样写：

```text
使用 $req-maker，把这份规格说明整理成 inputs/req.md。
```

## 仓库结构

```text
.
  install.mjs
  README.md
  README.zh-CN.md
  .codex-plugin/
    plugin.json
  skills/
    req-maker/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      install.py
      assets/
      scripts/
    req-reviewer/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      agents/
    plan-doc-maker/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      assets/
      agents/
    plan-executor/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      install.py
      agents/
    commit-push/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      scripts/
    piflow-status-inspector/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      agents/
      scripts/
```

## 运行要求

- 仓库根目录安装器需要 Node.js。
- Python 是可选的。`skills/req-maker/install.py` 只是兼容 wrapper，会调用根目录 Node.js 安装器。
- `commit-push` 使用 `git`；可选的 GitHub remote 自动创建能力需要 `gh` 和已认证的 GitHub 账号。
- `piflow-status-inspector` 使用 Node.js 读取并解析 `output-stages/stages.json`。
- Codex plugin 安装的最后一步需要通过 `codex` 命令执行 `codex plugin add`。如果没有该命令，安装器仍会写入 marketplace 条目。

## 开发说明

- 新增 skill 时，在 `skills/` 下创建目录，并补齐必备文件：
  `SKILL.md`、`VERSION`、`CHANGELOG.md`、`README.md`、`README.zh-CN.md`
  和 `install.mjs`。
- 根目录安装器通过扫描 `skills/` 的一级子目录来发现包含 `SKILL.md` 的可安装 skill。
- 安装行为统一维护在 `install.mjs`；各 skill 本地安装脚本应保持为轻量 wrapper。
- `README.md` 作为英文说明，`README.zh-CN.md` 作为中文说明。
