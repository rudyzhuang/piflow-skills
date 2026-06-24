# 隐私/数据处理审计映射

## 数据清单

- 用户基础字段、会话 token、授权结果、设备标识。
- 记录数据采集来源（input/task）、用途、保存时长和删除时机。

## 映射方法

- 对应到 `design.implementation_spec.api_contracts` 与 `acceptance` 中的字段。
- 每个采集点都需有合法用途和边界说明。

## 禁止事项

- 在日志、埋点、控制台中输出 token、手机号、身份证明等敏感信息。
