# fast-items

## 模块职责

`fast-items` 承载 item 业务上下文的 CRUD API、业务规则、Repository 查询、分页、排序和过滤试点能力。

## 表 Owner

- `item`：Item 表，由 `fast-items` 拥有。
- 修改 `item` 表字段时必须同步 Alembic migration，并检查 metadata diff。

## Public API

- `fast_items.module.items_module`：应用层注册 item 路由的入口。
- 当前没有跨模块 public API；如其他模块需要 item 能力，应新增 `public.py` 并只暴露稳定 schema 或普通值。
- `fast_items.schemas.ItemPublic`：模块内 HTTP 输出 schema。

## 稳定边界

- `fast_items.module`：应用层装配入口。
- `fast_items.schemas`：允许其他模块复用稳定 schema、DTO 和普通值对象。
- `fast_items.models`：允许应用层 model registry、测试、关系建模和类型标注使用；跨模块业务能力调用应新增 `fast_items.public`。
- `fast_items.deps`：当前只供本模块 Router 使用；如其他模块需要注入 item 能力，应先明确 public API。
- `fast_items.service`、`fast_items.repository`、`fast_items.routers`：模块内部实现，其他业务模块不得直接导入。

## 主要依赖

- `fast-core`：Session dependency、公共错误、分页和 OpenAPI 响应约定。
- `fast-auth`：当前用户 dependency 和 item owner 关系。
- `fastapi`：Router、Query 和 dependency 装配。
- `sqlmodel`：Item table model、schema 和 repository 查询。
