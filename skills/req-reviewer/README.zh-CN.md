# req-reviewer

English documentation: [README.md](./README.md).

`req-reviewer` 是一个用于评审并修订已有中文需求文档的 Agent Skill，尤其适用于项目中的 `inputs/req.md`。

它会检查来源覆盖、模板格式、需求质量、一致性、`feature_id` 规则、多客户端契约、兼容性和可测试性，并直接修订需求文档，重复评审与修订循环，直到文档通过并标记为 `已评审`。

## 核心能力

- 定位目标项目和需求文件。
- 优先加载 PiFlow 需求模板作为结构合同。
- 首次写入前备份 `inputs/req.md`。
- 检查来源覆盖和需求质量。
- 校验功能 ID、优先级、阶段、客户端目标、依赖、测试用例、鉴权、部署和技术约束。
- 直接修订需求文档。
- 重复评审和修订，直到没有实质问题。
- 在适用时只提交并推送需求文档、备份文件和直接相关评审产物。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs req-reviewer
```

也可以在本 skill 目录运行兼容 wrapper，它会转发到根目录安装脚本：

```bash
node install.mjs
```

常用安装选项：

```bash
node ../install.mjs req-reviewer --dry-run
node ../install.mjs req-reviewer --only codex
node ../install.mjs req-reviewer --only cursor
node ../install.mjs req-reviewer --only claude
node ../install.mjs req-reviewer --copy
```

## 使用示例

```text
使用 req-reviewer，评审 inputs/req.md，修订到通过并标记为已评审。
```

```text
Use $req-reviewer to review inputs/req.md, revise it until it passes, and mark it as 已评审.
```

## 文件结构

- `SKILL.md`：触发条件、评审流程、状态元数据规则、评审标准和最终响应要求。
- `VERSION`：当前 skill 版本号。
- `CHANGELOG.md`：版本变更记录。
- `README.md` / `README.zh-CN.md`：英文和中文说明文档。
- `install.mjs`：转发到根目录安装器的兼容 wrapper。
- `agents/openai.yaml`：OpenAI/Codex 展示信息和默认提示。
