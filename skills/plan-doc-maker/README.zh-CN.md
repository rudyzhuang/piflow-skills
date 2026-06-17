# plan-doc-maker

English documentation: [README.md](./README.md).

`plan-doc-maker` 是一个用于生成和维护中文方案文档的 Agent Skill。它会在目标项目本地 `docs/plans/` 下生成技术方案、实施方案、架构方案、迁移方案、重构方案或升级方案，并执行评审与修订循环直到通过。

它还会维护 `docs/plans/plan_index.md`，作为项目级去重执行索引，统一整合同一项目下所有方案文档中的活跃修改点。

## 核心能力

- 写入方案前先定位并校验真实目标项目。
- 生成 `<yyyymmdd-HHmm>-<proposal>.md` 格式的方案文档。
- 对每份方案执行评审、修订、再评审，直到通过。
- 维护 `docs/plans/plan_index.md`。
- 将多份来源方案中涉及同一实现面或决策面的交叉修改整合为一个修改点。
- 在合并后的修改点中保留所有来源文档引用。
- 对冲突方案从合理性、正确性、一致性、兼容性、实现风险、上线安全、可测试性等角度评审并形成最终整合方案。
- 当高影响冲突无法仅靠仓库证据判断时，向用户列出可选方案、优缺点、风险和推荐项，并等待用户确认。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs plan-doc-maker
```

也可以在本 skill 目录运行兼容 wrapper，它会转发到根目录安装脚本：

```bash
node install.mjs
```

常用安装选项：

```bash
node ../install.mjs plan-doc-maker --dry-run
node ../install.mjs plan-doc-maker --only codex
node ../install.mjs plan-doc-maker --only cursor
node ../install.mjs plan-doc-maker --only claude
node ../install.mjs plan-doc-maker --copy
```

## 使用示例

生成新方案：

```text
使用 plan-doc-maker，生成一个认证升级技术方案，写入 docs/plans/ 并评审到通过。
```

维护方案索引：

```text
使用 plan-doc-maker，整合当前项目 docs/plans/ 下的方案并维护 plan_index.md。
```

英文显式调用：

```text
Use $plan-doc-maker to create an authentication upgrade plan under docs/plans/ and review it until it passes.
```

## 文件结构

- `SKILL.md`：触发条件、方案生成流程、评审标准、`plan_index.md` 规则和最终响应要求。
- `VERSION`：当前 skill 版本号。
- `CHANGELOG.md`：版本变更记录。
- `README.md` / `README.zh-CN.md`：英文和中文说明文档。
- `install.mjs`：转发到根目录安装器的兼容 wrapper。
- `assets/plan-template.md`：内置方案模板。
- `agents/openai.yaml`：OpenAI/Codex 展示信息和默认提示。
