# 抖音小程序项目约束要点

## 目标结构

- 保持 `src/pages`、`src/components`、`src/store`、`src/platform/tt`。
- 平台分发侧仅允许在 `src/platform/tt` 做能力差异。

## 页面与路由

- `app.ts`（或项目统一入口）应声明首页、tab、分包和权限配置。
- 避免在业务逻辑层直接写 `tt.redirectTo` 等静态跳转；统一走 `route adapter`。

## 请求与网络

- `tt.request` 封装在 `api.ts` 适配器内，统一做超时、错误码映射、脱敏日志。
- 不写死生产域名；通过运行时配置注入 base URL。

## 生命周期与状态

- 在 `page.onShow`、`page.onHide`、`onPullDownRefresh` 中处理关键行为与埋点。
- 与登录相关的 token 生命周期必须有失效与刷新策略，避免长 session 无效导致反复授权。
