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

draft-from-sources 模式下，项目简介只写产品定位和值主张。
项目整体功能需求请写到 `## 核心功能 *` 头部的 project-level freeform_content。
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
只保留你真的要做的端，并在冒号后写清楚这个端给谁用、做什么。没有写在本节的端不会由 setup 自动增加，除非功能或测试明确声明了该端且形成缺口。

可选端：
- website: 面向普通用户的网站，例如浏览、搜索、下单、个人中心。
- admin: 面向管理员或运营人员的后台，例如管理用户、订单、内容。
- backend: 给网站、后台或 App 提供登录、数据读写、任务处理等能力。
- mobile: 面向 iOS / Android 用户的手机 App。
- desktop: 面向 Windows / Mac 用户的桌面应用。
- miniapp: 面向微信小程序、支付宝小程序、抖音小程序、快手小程序、百度小程序、头条小程序、QQ小程序、360小程序、美团小程序、饿了么小程序、口碑小程序、钉钉小程序、飞书小程序、企业微信小程序。

字段说明：
- target: 端标识，必填。
- positioning: 用一句话说明这个端给谁用、做什么，必填。
- layout_shell: 可选。admin / website 端的整体布局外壳，常见值：sidebar（左侧边栏）、topnav（顶部导航）、blank（无框架）。
- default_route: 可选。进入该端后默认跳转的路由，如 /projects、/dashboard。
- menu: 可选，仅 admin 端需要。写后台一级菜单名称列表，例如 [项目管理, 用户管理, 系统设置]。

复制下面这段来新增客户端（删除不需要的字段）：

- target: website
  positioning:

- target: admin
  positioning:
  layout_shell: sidebar
  default_route:
  menu: []

- target: backend
  positioning:

- target: desktop
  positioning:

- target: mobile
  positioning:
-->

## 核心功能 *

<!--
每个 Feature 写一个“用户能完成的事情”。
不要写成技术任务，例如“建数据库表”；要写成业务结果，例如“用户可以保存笔记”。

字段说明：
- feature_id：已有功能请保留；新功能可留空，流水线会生成。
- priority：must=首版必须有；should=应该有但可协商；nice=以后有时间再做。
- phase：mvp=首版；v1=首版后的第一轮增强；later=以后再做。
- client_targets：这个功能涉及哪些端，例如 [website, backend]；只能填写本需求已启用的端。
- structured_source：结构化字段来源，user=用户填写，ai=AI 生成或补齐。
- freeform_source：自由描述来源，推荐使用 from_user / from_ai；兼容旧值 user / ai。from_user 表示来自用户原始描述并经 AI 梳理，from_ai 表示 AI 根据结构化字段推理补齐。
- requirement_id / item_id / source_item_id / version_number / version_hash / version_status：可选追溯字段，通常由上游需求系统导出，人工编写时可省略。version_status 可为 draft、ai-reviewed、reviewed，仅表示上游需求清单项当前版本状态，不是通用流水线必填门禁。
- description：用普通业务语言说明功能。
- user_stories：可选，写“作为谁，我希望做什么，以便得到什么结果”。
- acceptance_criteria：验收标准，写“做到什么程度才算完成”。
- dependencies：依赖条件，例如另一个功能、第三方账号、业务资料。
- freeform_content：draft-from-sources 和评审态必填。用普通话描述这个 feature 对应的自然语言功能需求，包括用户目标、预期行为、关键状态和业务效果；不要复制整个项目简介，也不要只重复标题。导出模式下按上游数据规则处理。

项目级自由描述：
在本节标题后、第一条 Feature 前，写项目整体功能描述。若来自用户 prompt、文档、Figma Make、截图或 Backend export，经 AI 梳理后仍标记 freeform_source: from_user；若由评审 Agent 汇总各 feature 推理补齐，则标记 freeform_source: from_ai。

freeform_source: from_user
freeform_content:

复制下面这段来新增功能：

### Feature: website 端 - 功能名称

feature_id:
priority: must
phase: mvp
client_targets: [website, backend]
structured_source: user
freeform_source: from_user
requirement_id:
item_id:
source_item_id:
version_number:
version_hash:
version_status:
description:

freeform_content:

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
- structured_source：结构化测试字段来源，user=用户填写，ai=AI 生成或补齐。
- freeform_source：自由描述来源，推荐使用 from_user / from_ai；兼容旧值 user / ai。
- requirement_id / item_id / source_item_id / version_number / version_hash / version_status：可选追溯字段，通常由上游需求系统导出，人工编写时可省略。version_status 可为 draft、ai-reviewed、reviewed，仅表示上游需求清单项当前版本状态，不是通用流水线必填门禁。
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
structured_source: user
freeform_source: from_user
requirement_id:
item_id:
source_item_id:
version_number:
version_hash:
version_status:

freeform_content:

preconditions:
  -

steps:
  -

expected:
  -

test_data:
  -

## 部署 *

<!--
云平台与主域名。

cloud_provider 可选：
- cloudflare：国外
- tencent：国内（腾讯云）
- localhost：本机（一般用于开发）

若 cloud_provider 为 localhost，domain 也必须填 localhost（不要用 127.0.0.1 或其它主机名）。

domain：只填主域名，不要写 https://，不要写 /website、/admin、/api 这些路径。

什么时候要填 domain：
- 做 website、admin 或 backend 时，需要填。
- 只做 mobile，且暂时没有服务端访问地址时，可以留空。

流水线会自动推导：
- 启用 website 时 -> https://<你的域名>/website/
- 启用 admin 时   -> https://<你的域名>/admin/
- 启用 backend 时 -> https://<你的域名>/api/v1/
-->

cloud_provider: cloudflare

domain=

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
