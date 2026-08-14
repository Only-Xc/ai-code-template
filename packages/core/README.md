# fast-core

`fast-core` 是 monorepo 的基础公共包，只承载跨模块复用、无业务语义、可稳定演进的基础能力。

## 职责范围

可放入 `fast-core` 的能力包括：

- Settings、database、dependency alias、unit of work 等运行时基础设施。
- 错误类型、通用 OpenAPI 错误响应、分页等跨模块工程能力。
- 仅依赖 `packages/*` 或第三方库，不依赖 `apps/*` 或 `modules/*`。

不得放入 `fast-core` 的内容包括：

- 带有业务领域含义的 schema、model、service、repository。
- 只服务单个模块、没有明确复用方的 helper。
- 只服务单个应用的 HTTP 运行期能力，例如应用日志、request context middleware、health check、安全响应头、限流策略、OpenAPI tags。
- 需要导入 `app.*`、`fast_auth.*`、`fast_items.*` 等应用或业务模块的能力。

## 准入判断

新增公共能力进入 `fast-core` 前必须满足以下条件：

1. 至少被两个模块复用，或已被一个模块使用且第二个明确使用方已在 roadmap/issue/PR 描述中列出。
2. API 名称和参数不包含业务语义，例如 user、item、order 等领域概念。
3. 能力可独立测试，不依赖真实应用启动、业务数据库状态或某个模块的 ORM model。
4. 放在 `fast-core` 后不会让 `packages/* -> modules/*` 或 `packages/* -> apps/*` 的依赖方向反转。

## 测试要求

每个新增或修改的公共能力必须包含：

- 覆盖正常路径的单元测试。
- 覆盖失败路径、边界值或配置覆盖的测试。
- 如能力影响 FastAPI 行为，补最小 TestClient/API 测试。
- 如能力影响 schema、metadata 或 migration，补 metadata/schema 检查。

测试应放在 `packages/core/tests/` 下，并能通过：

```bash
uv run pytest packages/core/tests -m "not slow" -q
```

## Breaking Change 迁移说明模板

涉及公共 API、配置项、错误结构、dependency alias、schema 或返回值的 breaking change，必须在 PR 或文档中写明：

```md
### fast-core breaking change

- 变更能力：
- 旧 API / 行为：
- 新 API / 行为：
- 影响范围：
- 迁移步骤：
- 兼容层或回滚方案：
- 验证命令：
```

## 审查清单

- [ ] 至少两个模块复用，或第二个使用方已明确。
- [ ] 不包含业务语义。
- [ ] 不依赖 `apps/*` 或 `modules/*`。
- [ ] 已补测试和最小示例。
- [ ] Breaking change 已包含迁移说明。
