# fast-auth

## 模块职责

`fast-auth` 承载认证、用户账号、密码恢复、token、邮件模板和用户管理相关 API。模块内部按 Router -> Service -> Repository 分层，应用层只通过 `auth_module` 注册路由。

## 表 Owner

- `user`：用户账号表，由 `fast-auth` 拥有。
- 修改 `user` 表字段时必须同步 Alembic migration，并检查 metadata diff。

## Public API

- `fast_auth.module.auth_module`：应用层注册认证与用户路由的入口。
- `fast_auth.public.CurrentUserDep`：跨模块读取当前用户的稳定 dependency。
- `fast_auth.public.AuthPublicApi`：跨模块访问用户相关能力的稳定 public API，默认返回稳定 schema 或普通值。
- `fast_auth.schemas.UserPublic`：跨模块可使用的稳定用户输出 schema。

## 稳定边界

- `fast_auth.module`：应用层装配入口。
- `fast_auth.public`：跨模块方法调用入口。
- `fast_auth.deps`：允许其他模块复用明确公开的 FastAPI dependency，例如当前用户和权限校验。
- `fast_auth.schemas`：允许其他模块复用稳定 schema、DTO 和普通值对象。
- `fast_auth.models`：允许应用层 model registry、测试、关系建模和类型标注使用；跨模块业务能力调用不得绕过 `fast_auth.public`。
- `fast_auth.services`、`fast_auth.repositories`、`fast_auth.routers`：模块内部实现，其他业务模块不得直接导入。

## 主要依赖

- `fast-core`：settings、database deps、错误处理、安全工具、OpenAPI 响应约定。
- `fastapi`：Router、Depends、OAuth2 表单和安全依赖。
- `sqlmodel`：用户 table model、schema 和 repository 查询。
- `emails` / SMTP settings：账户创建和密码恢复邮件内容。
