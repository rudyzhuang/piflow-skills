# 抖音 API 适配层清单

## 推荐职责分层

- `src/platform/tt/api.ts`：封装 `tt.request`、鉴权注入、错误码归一化。
- `src/platform/common/api.ts`：定义统一返回类型和统一 `ApiResponse<T>`。
- `src/platform/tt/storage.ts`：按最小权限封装本地存储和缓存过期。
- `src/platform/tt/image.ts`：统一图片上传/预览能力并做 MIME 与大小校验。

## 禁止项

- 不要让业务模块直接 import `tt`。
- 不要在一个 Adapter 中混入微信/支付宝能力常量导致编译污染。

## 可校验项

- 若使用文件选择/上传，检查文件大小上限和类型白名单。
- 调用失败路径要返回可追踪错误对象和回退文案。
