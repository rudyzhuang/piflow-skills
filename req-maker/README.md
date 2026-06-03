# req-maker

`req-maker` 是一个用于生成和导出项目需求文档的 Agent Skill。它会从用户输入、产品笔记、需求说明、截图转写内容、Figma Make 本地副本（`.make`）或其他文档中提炼需求，并按照 PiFlow 需求模板生成 `inputs/req.md`。它也兼容 piflow-cli 的 Backend `req-md-export` 流程，可以从结构化导出数据或已渲染 Markdown 写入 `inputs/req.md`。

从草稿来源生成需求时，它还会执行两轮评审和修订：

- 来源覆盖评审：检查输入材料中的事实、约束、目标、功能、风险等是否遗漏或失真。
- 需求质量评审：检查需求是否合理、一致、完整，功能优先级、客户端目标、测试用例等是否匹配。

两轮评审都会按发现的问题修改 `inputs/req.md`，直到评审通过。

在 `export-req-md` 模式下，Backend 导出数据是唯一业务来源；skill 会保留 `requirement_id`、`item_id`、`source_item_id`、`version_number`、`version_hash`、`version_status` 等追溯字段，并执行结构、字段和敏感信息自检。AI 评审把 freeform 一对多拆成 structured 清单项时，导出结果只渲染派生 structured 项，并通过 `source_item_id` 追溯原 freeform 来源项。

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

Backend 导出兼容示例：

```text
使用 req-maker 的 export-req-md 模式，根据 Backend 的 GET /api/v1/projects/:id/req-md-export 返回内容生成 inputs/req.md。
```

可直接运行 helper 脚本处理本地导出文件：

```bash
node req-maker/scripts/export-req-md.mjs \
  --input /path/to/req-md-export.json \
  --output /path/to/project/inputs/req.md
```

也可让脚本请求 Backend：

```bash
node req-maker/scripts/export-req-md.mjs \
  --api-base-url https://piflow.org/api/v1 \
  --project-id project_uuid \
  --device-api-key "$DEVICE_API_KEY" \
  --workspace-root /Users/name/piflow-projects
```

也可以提供导出上下文：

```json
{
  "mode": "export-req-md",
  "api_base_url": "https://piflow.org/api/v1/",
  "project_id": "project_uuid",
  "run_id": "run_uuid",
  "device_api_key": "secret",
  "workspace_root": "/Users/name/piflow-projects",
  "template_path": "/Users/guodongzhuang/github/piflow/templates/req-template.md",
  "output_path": "/Users/name/piflow-projects/project_uuid/inputs/req.md"
}
```

遇到 `.make` 文件时，skill 会把它当作 Figma Make 的 zip-like 本地包处理，优先读取其中的 `meta.json` 和 `ai_chat.json`，提取原始设计提示、后续修改需求、版本历史和实现摘要。`canvas.fig` 是 Figma Make 的二进制画布数据，当前不会被声明为完整图层树来源；如需视觉细节，应结合截图、缩略图或普通 Figma `/design/...` 链接。

草稿模式生成结果会写入当前项目：

```text
<project-root>/inputs/req.md
```

导出模式默认写入：

```text
<workspace_root>/<project_id>/inputs/req.md
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
- 部署域名，或 piflow-cli 模板中的部署章节
- 鉴权方案
- 技术约束
- 其他说明

如果信息可以合理推断，skill 会直接补充；如果确实未知，会写 `暂不确定` 或按模板允许的方式留空。

生成 `## 核心功能 *` 时，`req-maker` 会自动为新功能生成 PiFlow 风格 `feature_id`，例如 `AUTH-LOGIN-001`、`WEB-SEARCH-001`、`BACKEND-HEALTH-001`。单端功能使用端前缀，跨端功能使用业务领域前缀，并在评审时检查唯一性、格式和端前缀是否匹配。

导出模式下，Backend 已提供的非空 `feature_id` 会被原样保留；如果 Backend 有意留空，skill 只保留字段，不擅自补业务事实。每个来自 Backend 的 Feature 都会保留追溯字段，并在验收标准里补入对应追溯信息，方便后续 report 关联需求版本。Test Case 也会保留 `item_id`、`source_item_id`、`version_number`、`version_hash`、`version_status`，确保测试结果能回溯到需求清单版本。

当 Backend 返回结构化 JSON 时，`structured_content` 是模板字段的主来源；`freeform_content` 只在描述缺失时兜底，不会作为独立章节输出。`structured_source` 和 `freeform_source` 仅用于校验和追溯，不会写入最终 `req.md`。

## 工作流程

`req-maker` 的草稿模式核心流程如下：

1. 定位项目根目录。
2. 收集用户输入和提供的文档材料。
3. 加载项目本地模板，或使用内置模板 `assets/req-template.md`。
4. 提炼并规范化需求。
5. 写入初版 `inputs/req.md`。
6. 执行来源覆盖评审，按建议修改，直到通过。
7. 执行需求质量评审，按建议修改，直到通过。
8. 校验输出文件和模板章节。

`export-req-md` 模式核心流程如下：

1. 接收 `project_id`、`run_id`、`device_api_key`、`workspace_root`、`template_path` 等上下文。
2. 请求或读取 `GET /api/v1/projects/:id/req-md-export` 的导出结果。
3. 如果响应是 JSON，按 `ReqMdExportDocument` 校验、规范化并渲染 Markdown。
4. 如果响应是 Markdown，只做章节顺序和敏感信息检查，通过后直接写入。
5. 首选 piflow 仓库模板 `/Users/guodongzhuang/github/piflow/templates/req-template.md`，不可读时使用内置模板。
6. 检查必需章节、Feature 字段、Test Case 字段、追溯字段、AI 拆分来源、domain 格式和敏感信息泄漏。
7. 写入 `<workspace_root>/<project_id>/inputs/req.md`，并返回成功或安全失败摘要。

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
    export-req-md.mjs
    figma-make-summary.mjs
```

关键文件：

- `SKILL.md`：skill 主说明，定义触发条件、生成流程、评审流程和输出要求。
- `VERSION`：skill 当前版本号。
- `assets/req-template.md`：内置 PiFlow 需求模板。
- `scripts/export-req-md.mjs`：读取或请求 Backend `req-md-export`，校验 JSON/Markdown，渲染结构化需求到 `inputs/req.md`。
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
