---
name: commit-push
description: >-
  通用 Git 提交推送 Skill：按变更与对话意图生成 commit message，执行 add/commit/push，
  支持多仓库分组、自动代理、自动建远端仓库、自动维护项目与子项目版本日志。
  在用户说「提交推送」「提交并推送」「commit push」「push 上去」或要求把当前改动提交到远程时使用。
---

# commit-push — 通用提交推送 Skill

将「提交推送」固化为可重复流程：**Git 采集事实** + **对话归纳目的** + **脚本执行**。

> **通用 Skill**：不依赖任何特定项目框架，可在任意 git 仓库中使用（含 std4、piflow 及普通业务仓库）。

功能全景、CLI 参考与版本维护约定见 [README.md](./README.md)。

脚本在**当前 git 仓库根**（或 `--cwd=` 指定目录）运行，只对该仓库做 commit/push；版本维护同样只作用于该仓库。

## 安装 / 同步到本机 Agent

在本 skill 目录执行：

```bash
node install.mjs
```

安装脚本跨 OS 可用，会检测本机已存在的 `~/.cursor`、`~/.codex`、`~/.claude`，并把当前 skill 链接到各自的 `skills/commit-push`；不存在的 Agent 配置目录会跳过。需要复制安装时使用 `node install.mjs --copy`。

## Agent 必读（执行顺序）

用户要求提交推送时，**必须先读本 skill**，再调用脚本；不要手写一长串 `git` 命令代替脚本（除非脚本失败需排障）。

### 1. 归纳修改目的（对话层，脚本做不到）

从**当前对话**提炼一句 `--intent`，写**为什么改**，不要堆文件名：

- ✅ `--intent="对齐 pipeline 文档与 recovery 行为"`
- ❌ `--intent="改了 50 个 md 和 cjs"`

若用户已给出完整 commit 标题，改用 `-m="..."` 即可。

### 1b. 收集本次修改的文件（多仓库必做）

从**对话上下文**列出本次改动涉及的**文件路径**（Agent 在对话里能看到的那些），通过 CLI 传给脚本：

```bash
node ~/.cursor/skills/commit-push/scripts/commit_push.cjs \
  --intent="..." \
  --file=/path/to/repo-a/foo.cjs \
  --file=/path/to/repo-b/bar.md \
  --dry-run
```

也可用 `--files=a,b,c` 或 positional 路径。脚本会：

1. 对每个文件向上查找 `.git` 根目录
2. **按仓库分组**
3. **在每个仓库内**仅 stage 范围内有变更的文件，分别维护版本、commit / push（可选建仓）

未传 `--file` 时：仅在 `--cwd`（或当前目录向上）的**单个** git 仓库内全量提交。

**Agent 禁止**手写多轮 `git add/commit/push` 代替脚本；跨仓库改动必须一次调用、传齐 `--file`。

### 2. 采集与预览（推荐先跑）

在**目标 git 仓库根**执行：

```bash
node ~/.cursor/skills/commit-push/scripts/commit_push.cjs \
  --intent="<上一步归纳的一句>" \
  --dry-run
```

阅读终端里的「分析报告」：变更文件数、主要目录、建议 Subject、将维护哪些项目或子项目版本。与用户意图不一致时，改 `--intent` 或 `-m` 再跑。

### 3. 正式提交推送

用户**明确要求推送**时（默认含 push）：

```bash
node ~/.cursor/skills/commit-push/scripts/commit_push.cjs \
  --intent="<目的>" \
  --yes
```

**推送前自动同步远端**（防止非快进冲突）：

脚本在 push 之前会自动执行：
1. `git fetch <remote>` — 拉取远端最新状态
2. 若远端领先本地，执行 `git pull --no-rebase <remote> <branch>` 合并
3. 合并成功后再 `git push`

若 pull 遇到冲突，脚本会报错退出，需手动解决冲突后重新推送。

**推送前默认设置代理**（无需每次手写 `export`）：

```text
http_proxy=https_proxy=http://127.0.0.1:1087
```

| 参数 | 何时用 |
| --- | --- |
| `--yes` | Agent 非交互环境必加；跳过「继续? [y/N]」 |
| `--cwd=<path>` | 指定 git 仓库根（默认从 cwd 向上查找 `.git`） |
| `--proxy=...` | 覆盖默认代理地址 |
| `--no-proxy` | 推送不走代理（仅本地/内网 remote 时） |
| `--no-push` | 用户只说「提交」不说「推送」 |
| `-m="..."` | 用户指定完整 commit message |
| `--json-report` | 只需结构化报告、不执行 git |
| `--file=<path>` | 对话中的修改文件（可重复）；多仓库时按 git 根分组 |
| `--files=a,b,c` | 逗号分隔的修改文件列表 |
| `--create-remote` | 用户已同意时：远端缺失则 `gh repo create` 后推送 |
| `--github-public` | 建仓可见性为 public（默认 private） |
| `--github-visibility=private\|public` | 显式指定建仓可见性 |
| `--github-owner=<user\|org>` | 建仓 owner，默认 `gh auth` 当前用户 |
| `--github-repo=<name>` | 建仓仓库名，默认取目录名 slug |

也可在仓库根使用快捷入口：`node commit_push.cjs`（若仓库内安装了转发脚本）。

### 3b. 远端不存在时（可选自动建仓）

推送前脚本会检测 `git remote` 与 GitHub 仓库是否存在。若**未配置 remote** 或 **GitHub 上尚无对应仓库**：

1. 打印可选操作（自动建仓 / 手动配置 / `--no-push` 仅提交）
2. **交互终端**：询问是否用 `gh` 创建 **private** 仓库并继续推送
3. **Agent / 非交互**：用户已在对话中同意后，加 `--create-remote --yes`

```bash
# 用户同意建仓并推送（默认 private）
node ~/.cursor/skills/commit-push/scripts/commit_push.cjs \
  --intent="首次推送 piflow" \
  --create-remote --yes
```

要求：已安装并登录 `gh`（`gh auth login`）。非 GitHub remote 不会自动建仓。

### 4. 自动版本维护

**不硬编码任何项目名。** 脚本会在 `git add` 之前维护 `VERSION` 与 `CHANGELOG.md`：

1. 从本次变更路径向上查找子项目。包含 `SKILL.md` 的目录视为独立 skill 子项目。
2. 对有实质变更的子项目，先维护该子项目自己的 `VERSION` 与 `CHANGELOG.md`。
3. 再维护当前 git 仓库根目录的 `VERSION` 与 `CHANGELOG.md`。

如果目标目录缺少 `VERSION` 或 `CHANGELOG.md`，脚本会自动创建：

- 缺 `VERSION` 时初始化为 `0.1.0`。
- 缺 `CHANGELOG.md` 时创建 `# Changelog` 并前插本次提交记录。
- 已存在 `VERSION` 时执行 patch 升版，例如 `0.1.0 → 0.1.1`。

版本维护顺序固定为：**子项目 VERSION/CHANGELOG.md → 项目根 VERSION/CHANGELOG.md → git add → commit**。

`--dry-run` 会在报告中显示每个子项目和项目根的计划初始化或升版区间，不写入磁盘。

### 5. 回复用户

脚本结束时会打印 **`commit_push 操作报告`**（正式执行或 dry-run 均有）。Agent 应据此向用户说明：

- **涉及哪些仓库**、各仓分支与范围文件
- 逐步动作：版本维护、git add、commit、建仓、push
- 提交哈希与 commit 标题、版本初始化或升版区间、是否新建远端
- 跳过项与失败原因

多仓库时分条列出；不要只回复「已完成」而不引用报告要点。

## Git 安全（强制）

- **禁止** `git push --force` 到 `main`/`master`，除非用户明确要求
- **禁止** `git commit --amend`，除非用户规则允许且 HEAD 未推送
- **禁止** `git config` 修改
- **禁止** 提交 `.env`、`config.env`、`*.pem` 等（脚本会拦截；仍须人工确认 `git status`）
- 无变更时不要空提交

## 原理（与脚本的 division of labor）

| 层 | 来源 | 作用 |
| --- | --- | --- |
| 改了什么 | `git status` / `diff` / `log` + **`--file` 范围** | 脚本按文件分组到各 git 根 |
| 为什么改 | **对话** → `--intent` | Agent 填写 |
| 版本维护 | 当前仓库根目录，以及范围内含 `SKILL.md` 的子项目 | 脚本自动初始化或 patch 升版 `VERSION` / `CHANGELOG.md` |
| 远端建仓 | 推送前检测 + 用户 `--create-remote` 同意 | 脚本 `github_remote.cjs` |
| 怎么提交 | `commit_push.cjs` | 子项目版本维护 → 根项目版本维护 → add → commit → push |

脚本路径：`~/.cursor/skills/commit-push/scripts/commit_push.cjs`

## 故障

| 现象 | 处理 |
| --- | --- |
| `Repository not found` / 远端不可用 | 见下方「远端不存在」；用户同意后加 `--create-remote --yes` |
| 远端不存在 / 未配置 origin | 脚本会列出选项；交互模式可确认建仓；Agent 用 `--create-remote --yes` |
| `nothing to commit` | 无变更或已被 ignore |
| 版本维护: 跳过 | 范围内没有可维护项目或只有无需提交的状态 | 正常 |
| 建议标题离谱 | 补全或改写 `--intent`，勿只靠启发式 |
| `git pull 合并失败` | 远端有冲突文件，手动 `git pull`、解决冲突、`git add`、`git commit`，再重新运行脚本推送 |
| fetch 失败但继续推送 | 仅打印警告，常见于首次推送（远端分支尚不存在），脚本仍会执行 `push -u` |
