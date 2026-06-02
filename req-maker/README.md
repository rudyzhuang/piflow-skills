# req-maker

`req-maker` 是一个用于生成项目需求文档的 Agent Skill。它会从用户输入、产品笔记、需求说明、截图转写内容、Figma Make 本地副本（`.make`）或其他文档中提炼需求，并按照 PiFlow 需求模板生成 `inputs/req.md`。

生成完成后，它还会执行两轮评审和修订：

- 来源覆盖评审：检查输入材料中的事实、约束、目标、功能、风险等是否遗漏或失真。
- 需求质量评审：检查需求是否合理、一致、完整，功能优先级、客户端目标、测试用例等是否匹配。

两轮评审都会按发现的问题修改 `inputs/req.md`，直到评审通过。

## 支持的工具

安装脚本会自动发现本机已安装或已配置的 Agent，并把当前 skill 安装到它们的用户级 skill 目录。

支持目标：

- Cursor: `~/.cursor/skills/req-maker`
- Codex: `~/.codex/skills/req-maker`
- Claude Code: `~/.claude/skills/req-maker`

默认安装方式是创建链接，也就是这些目录会指向当前源码目录。这样电脑上只保留一份 `req-maker` 代码，后续修改本目录会自动对各 Agent 生效。

## 安装

推荐在 `myskills` 根目录运行统一安装脚本：

```bash
node install.mjs req-maker
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
node ../install.mjs req-maker --dry-run
```

安装到所有已知目录，即使没有检测到对应工具：

```bash
node ../install.mjs req-maker --all
```

只安装到某个工具：

```bash
node ../install.mjs req-maker --only cursor
node ../install.mjs req-maker --only codex
node ../install.mjs req-maker --only claude
```

同时选择多个工具：

```bash
node ../install.mjs req-maker --only codex --only claude
```

安装目录下所有 skill：

```bash
node ../install.mjs --all-skills
```

使用复制方式安装，而不是链接：

```bash
node ../install.mjs req-maker --copy
```

`--copy` 适合不允许创建 symlink 的系统或环境。复制安装后，如果修改本目录，需要重新运行安装脚本同步到各 Agent。

## 如何使用

安装完成后，在支持 skills 的 Agent 中直接提出生成需求的请求即可。Agent 会根据 `SKILL.md` 的描述自动选择本 skill；也可以显式点名使用。

示例：

```text
Use $req-maker to turn my product notes into inputs/req.md.
```

中文示例：

```text
使用 req-maker，根据下面的产品想法生成 inputs/req.md，并评审到通过。
```

带文档示例：

```text
使用 req-maker，读取 docs/product-notes.md 和 docs/spec.md，生成项目的 inputs/req.md。
```

带 Figma Make 本地文件示例：

```text
使用 req-maker，读取 /path/to/产品 UI.make，生成项目的 inputs/req.md。
```

遇到 `.make` 文件时，skill 会把它当作 Figma Make 的 zip-like 本地包处理，优先读取其中的 `meta.json` 和 `ai_chat.json`，提取原始设计提示、后续修改需求、版本历史和实现摘要。`canvas.fig` 是 Figma Make 的二进制画布数据，当前不会被声明为完整图层树来源；如需视觉细节，应结合截图、缩略图或普通 Figma `/design/...` 链接。

生成结果会写入当前项目：

```text
<project-root>/inputs/req.md
```

## 生成内容

`req-maker` 会尽量补齐 PiFlow 需求模板中的关键部分：

- 项目名称
- 项目简介
- Agent 设置
- 客户端目标
- 核心功能
- 非功能需求
- 测试用例
- 部署域名
- 鉴权方案
- 技术约束
- 其他说明

如果信息可以合理推断，skill 会直接补充；如果确实未知，会写 `暂不确定` 或按模板允许的方式留空。

生成 `## 核心功能 *` 时，`req-maker` 会自动为新功能生成 PiFlow 风格 `feature_id`，例如 `AUTH-LOGIN-001`、`WEB-SEARCH-001`、`BACKEND-HEALTH-001`。单端功能使用端前缀，跨端功能使用业务领域前缀，并在评审时检查唯一性、格式和端前缀是否匹配。

## 工作流程

`req-maker` 的核心流程如下：

1. 定位项目根目录。
2. 收集用户输入和提供的文档材料。
3. 加载项目本地模板，或使用内置模板 `assets/req-template.md`。
4. 提炼并规范化需求。
5. 写入初版 `inputs/req.md`。
6. 执行来源覆盖评审，按建议修改，直到通过。
7. 执行需求质量评审，按建议修改，直到通过。
8. 校验输出文件和模板章节。

## 项目结构

```text
install.mjs
req-maker/
  SKILL.md
  VERSION
  README.md
  install.py
  install.mjs
  agents/
    openai.yaml
  assets/
    req-template.md
  scripts/
    figma-make-summary.mjs
```

关键文件：

- `SKILL.md`：skill 主说明，定义触发条件、生成流程、评审流程和输出要求。
- `VERSION`：skill 当前版本号。
- `assets/req-template.md`：内置 PiFlow 需求模板。
- `scripts/figma-make-summary.mjs`：解析 Figma Make 本地 `.make` 文件，输出可用于需求提取的 Markdown 摘要。
- `../install.mjs`：仓库根目录通用安装脚本。
- `install.py` / `install.mjs`：兼容 wrapper，转发到根目录安装脚本。
- `agents/openai.yaml`：OpenAI/Codex 相关展示和默认提示配置。

## 注意事项

- 默认安装为链接模式，请保留本目录，不要在安装后删除源码目录。
- 如果移动了本目录，请重新运行安装脚本。
- 如果目标目录已有同名 skill，安装脚本会替换为当前 `req-maker`。
- Windows 下 Node.js 安装脚本会使用 `junction` 创建目录链接，兼容性通常更好。
- 运行 `--dry-run` 可以先确认会安装到哪些目录。
