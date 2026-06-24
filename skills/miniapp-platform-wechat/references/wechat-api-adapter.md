# WeChat API Adapter

- Shared logic should not call `wx` directly.
- Add wrappers in platform adapter layer.
- Wrap async calls and normalize errors for deterministic retry and testability.
