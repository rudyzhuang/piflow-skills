# 项目需求说明

<!--
这份 req.md 是“人看的需求草稿”，适合先用自然语言把想法写清楚。
流水线最终会把它整理到 req.yaml 里，所以请尽量保留下面的标题和字段名。

填写时记住三件事：
1. 带 * 的部分请尽量填完整。
2. 不确定的地方可以先留空，或者写“暂不确定”。
3. 示例只写在注释里；真正填写时，把内容写到注释外面。
-->

## 项目名称 *

<!--
请写项目的中文名和英文名。
英文名会用来生成目录名、服务名等，所以建议简短、好拼写。

填写格式：
项目中文名：
项目英文名：
-->

## 项目简介 *

<!--
用一句话说清楚：
这个项目给谁用，解决什么问题，最重要的价值是什么。
-->

## Agent 设置

<!--
不知道怎么选就保留默认值。
agent_provider 表示用哪个 AI 工具执行流水线。
agent_model 写 auto 表示使用默认模型。
-->

agent_provider: cursor_sdk
agent_model: auto

## 客户端目标 *

<!--
只保留你真的要做的端，并在冒号后写清楚这个端给谁用、做什么。

可选端：
- website: 面向普通用户的网站，例如浏览、搜索、下单、个人中心。
- admin: 面向管理员或运营人员的后台，例如管理用户、订单、内容。
- backend: 给网站、后台或 App 提供登录、数据读写、任务处理等能力。
- mobile: 面向 iOS / Android 用户的手机 App。

如果要做后台，可以保留 layout_shell、default_route、menu。
menu 写后台菜单名称，例如 [项目管理, 用户管理, 系统设置]。
-->

## 核心功能 *

<!--
每个 Feature 写一个“用户能完成的事情”。
不要写成技术任务，例如“建数据库表”；要写成业务结果，例如“用户可以保存笔记”。

字段说明：
- feature_id：已有功能请保留；新功能可留空，流水线会生成。
- priority：must=首版必须有；should=应该有但可协商；nice=以后有时间再做。
- phase：mvp=首版；v1=首版后的第一轮增强；later=以后再做。
- client_targets：这个功能涉及哪些端，例如 [website, backend]。
- description：用普通业务语言说明功能。
- user_stories：可选，写“作为谁，我希望做什么，以便得到什么结果”。
- acceptance_criteria：验收标准，写“做到什么程度才算完成”。
- dependencies：依赖条件，例如另一个功能、第三方账号、业务资料。

复制下面这段来新增功能：

### Feature: website 端 - 功能名称

feature_id:
priority: must
phase: mvp
client_targets: [website, backend]
description:

user_stories:
  -

acceptance_criteria:
  -

dependencies: []
-->

## 非功能需求

<!--
这里写整体质量要求。没有特别要求可以留空。
请用普通句子写，不需要写专业指标。
-->

performance:
  -

security:
  -

availability:
  -

compliance:
  -

accessibility:
  -

## 测试用例

<!--
可选。这里写你最关心、上线前一定要验证的场景。

字段说明：
- feature_id：对应功能编号，不知道可留空。
- client_target：在哪个端测试，填 website、admin、mobile 或 backend。
- type：smoke=最基础检查；e2e=完整用户流程；api=接口检查；regression=防止旧功能坏掉；edge=边界情况；error=错误提示。
- priority：must=上线前必须通过；should=建议通过；nice=有时间再测。
- preconditions：测试前要准备好的条件。
- steps：用户怎么操作。
- expected：应该看到什么结果。
- test_data：测试数据。不要写真实密码、密钥或真实用户隐私。
-->

### TC-001: 用例标题

feature_id:
client_target:
type: e2e
priority: should

preconditions:
  -

steps:
  -

expected:
  -

test_data:
  -

## 部署域名

<!--
只填主域名，不要写 https://，不要写 /website、/admin、/api 这些路径。

什么时候要填：
- 做 website、admin 或 backend 时，需要填。
- 只做 mobile，且暂时没有服务端访问地址时，可以留空。

流水线会自动推导：
- website -> https://<你的域名>/website/
- admin   -> https://<你的域名>/admin/
- backend -> https://<你的域名>/api/v1/
-->

DOMAIN=

## 鉴权方案

<!--
写项目是否需要登录，以及大概怎么登录。

scheme 可选：
- none：不需要登录。
- jwt：常见的令牌登录。
- session：传统网页登录状态。
- oauth：微信、Google、GitHub 等第三方登录。
- custom：你有自己的登录方式。
-->

scheme: none
description:

## 技术约束

<!--
如果你或团队有明确技术要求，写在这里。
不关心技术选型时可以留空。
-->

stack_preferences:
  -

forbidden_frameworks: []

third_party_limits:
  -

repository_constraints:
  -

## 其他说明

<!--
这里写项目推进相关信息：
- release_deadline：希望什么时候上线。
- mvp_scope：首版只做什么、不做什么。
- known_risks：已知风险或还没准备好的条件。
- notes：其他想提醒流水线的信息。
-->

release_deadline:

mvp_scope:
  -

known_risks:
  -

notes:
