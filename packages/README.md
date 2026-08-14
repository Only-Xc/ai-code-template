# 公共包

`packages/` 用于存放跨业务模块复用的 Python 包。

约定：

- 目录名使用短横线或小写单词，例如 `core`、`utils`、`i18n`。
- Python import 包名使用 `fast_<name>`。
- 分发包名使用 `fast-<name>`。
- 公共包不依赖 `apps/*`。
- 公共包只放跨模块复用能力，业务流程放在 `modules/*`。
