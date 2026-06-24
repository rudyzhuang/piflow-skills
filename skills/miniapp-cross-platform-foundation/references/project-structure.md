# Miniapp Project Structure

Recommended shared structure:

- `src/pages/*`
- `src/components/*`
- `src/utils/*`
- `src/store/*`
- `src/platform/{wechat,douyin,alipay}`
- `src/services/*`
- `src/styles/*`
- `config/*` (env/build/deploy profiles)

Directory boundaries should be explicit and stable; feature logic should not depend on platform folder internals.
