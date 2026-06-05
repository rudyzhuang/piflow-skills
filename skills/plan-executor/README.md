# plan-executor

`plan-executor` 是一个用于按方案落地执行的 Agent Skill。它可以执行用户直接提供的方案描述、执行目标、`plan-doc-maker` 生成的方案文档，或默认读取当前项目的 `docs/plans/last_plan.md`，逐个完成待执行修改点，并在每个修改点后执行评审、修正、再评审，直到实现通过。

Agent 操作指南见 [SKILL.md](./SKILL.md)。

## 支持的工具

安装脚本会自动发现本机已安装或已配置的 Agent，并把当前 skill 安装到它们的用户级 skill 目录。

支持目标：

- Cursor: `~/.cursor/skills/plan-executor`
- Codex: `~/.codex/skills/plan-executor`
- Claude Code: `~/.claude/skills/plan-executor`

默认安装方式是创建链接，也就是这些目录会指向当前源码目录。这样电脑上只保留一份 `plan-executor` 代码，后续修改本目录会自动对各 Agent 生效。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs plan-executor
```

也可以在本 skill 目录运行兼容 wrapper，它会转发到根目录安装脚本：

```bash
node install.mjs
```

Python wrapper 同样只是转发：

```bash
python3 install.py
```

通用安装逻辑只维护在仓库根目录 `install.mjs` 中。

## 安装选项

预演安装，不写入文件：

```bash
node ../install.mjs plan-executor --dry-run
```

安装到所有已知目录，即使没有检测到对应工具：

```bash
node ../install.mjs plan-executor --all
```

只安装到某个工具：

```bash
node ../install.mjs plan-executor --only cursor
node ../install.mjs plan-executor --only codex
node ../install.mjs plan-executor --only claude
```

同时选择多个工具：

```bash
node ../install.mjs plan-executor --only codex --only claude
```

安装目录下所有 skill：

```bash
node ../install.mjs --all-skills
```

使用复制方式安装，而不是链接：

```bash
node ../install.mjs plan-executor --copy
```

`--copy` 适合不允许创建 symlink 的系统或环境。复制安装后，如果修改本目录，需要重新运行安装脚本同步到各 Agent。

## 如何使用

安装完成后，在支持 skills 的 Agent 中直接提出执行方案的请求即可。Agent 会根据 `SKILL.md` 的描述自动选择本 skill；也可以显式点名使用。

默认执行当前项目的 `docs/plans/last_plan.md`：

```text
使用 plan-executor，继续执行当前项目 docs/plans/last_plan.md 中未完成的方案。
```

直接提供方案目标：

```text
使用 plan-executor，按下面的方案完成实现、评审、修正并提交推送：……
```

直接提供 `plan-doc-maker` 生成的源方案文档：

```text
Use $plan-executor to implement docs/plans/20260605-1200-api-refactor.md, update its execution status, then commit and push.
```

## 工作流程

`plan-executor` 的核心流程如下：

1. 定位执行来源：用户方案、源方案文档，或默认 `docs/plans/last_plan.md`。
2. 拆分待执行修改点或临时执行清单。
3. 对每个修改点先阅读当前代码，判断是否已全部实现、部分实现或未实现。
4. 如果代码已经全部满足方案要求，不改代码，只做验证并维护方案状态为已执行。
5. 如果代码是部分实现或未实现，按方案继续实施未完成内容。
6. 每完成一个修改点，执行评审、修正、再评审，直到通过。
7. 更新 `last_plan.md`、源方案文档或临时执行清单状态。
8. 重新计算整体执行状态，确认没有遗漏。
9. 所有活跃修改点完成后，提交并推送。
10. 结束前输出本次执行汇总报告，说明执行来源、完成项、代码改动或无需改代码的原因、方案状态更新、验证结果和提交推送结果。

## 状态维护

当执行来源包含 `docs/plans/last_plan.md` 时，skill 会维护每个活跃修改点的：

- `评审状态`
- `执行状态`
- `状态记录`
- 验证证据或验收结果

当修改点引用 `plan-doc-maker` 生成的源方案文档，或用户直接提供源方案文档时，skill 会同步维护源方案中的实现状态，例如：

- `代码实现: 部分执行 | 已执行`
- `实现文档版本`
- `修改时间`
- 实现记录或等价状态字段

只有所有活跃修改点都执行并评审通过后，skill 才允许进入最终提交推送步骤。

## 汇总报告

每次执行结束前，`plan-executor` 都需要向用户输出本次执行汇总报告。报告至少说明：

- 本次执行的方案来源。
- 完成了哪些修改点或临时清单项。
- 实际做了哪些代码改动，或说明代码已满足方案所以未改代码。
- 更新了哪些方案状态字段。
- 做了哪些验证，哪些验证未执行及原因。
- commit 与 push 结果。

## 项目结构

```text
plan-executor/
├── SKILL.md
├── README.md
├── install.mjs
├── install.py
└── agents/
    └── openai.yaml
```
