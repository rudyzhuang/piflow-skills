# 支付宝 API 适配层清单

## 关键适配边界

- `src/platform/alipay/auth.ts`：授权、登录、userInfo 获取与降级策略。
- `src/platform/alipay/payment.ts`：支付链路下单、唤起、回调验签前置。
- `src/platform/alipay/storage.ts`：本地存储封装、敏感字段清洗与过期。
- `src/platform/alipay/request.ts`：统一错误码映射、请求日志和重试策略。

## 关键约束

- 业务模块不得直接 `import my`。
- 支付成功/失败要给出不可逆的状态结论，避免重复提交。
- 失败回调必须有重试和取消分支。
