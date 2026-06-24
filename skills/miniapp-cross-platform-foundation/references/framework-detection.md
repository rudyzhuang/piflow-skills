# Framework Detection

Detect target framework from project metadata and design context in priority order:

1. `framework` field (`taro`, `uni-app`, `wechat-miniapp`, `douyin-miniapp`, `alipay-miniapp`).
2. Source root hints (`taro.config.*`, `manifest.json`, `src/app.config.ts`, native miniapp configs).
3. Explicit design target from `design-spec` / PRD.

Decision rule:

- If `framework=taro` or `uni-app`, use shared cross-platform flow by default.
- If `framework` is native miniapp, keep shared rules but tighten API mapping through platform skills.
