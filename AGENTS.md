## 项目规则

- 代码生成或修改后按三层策略运行校验：
  - 先用 `git diff --name-only` 识别本次涉及路径，再映射到 workspace：`apps/admin-web` -> `@ai-app/admin-web`，`packages/api` -> `@ai-app/api`，`packages/components` -> `@ai-app/components`，`packages/dictionaries` -> `@ai-app/dictionaries`，`packages/utils` -> `@ai-app/utils`。
  - 日常代码改动只运行涉及 workspace 的校验，例如 `pnpm --filter @ai-app/api --filter @ai-app/admin-web lint` 和对应 `typecheck`。
  - 修改共享包时同时校验直接受影响应用；修改 `packages/api`、`packages/components`、`packages/dictionaries`、`packages/utils` 后，按实际引用关系补跑 `apps/admin-web`。
  - 修改根配置、锁文件、工具链、跨 workspace 公共规则，或准备提交前，运行 `npm run lint` 和 `npm run typecheck` 全量校验。

## antd 工作流

- 写任何 antd 组件前先查官方 API 签名（版本必须对齐 `packages/components`/`apps/admin-web` 实际安装版本），不凭记忆写已被弃用的属性；改完用 lint 扫描该文件确认无 deprecated 用法。
- v6 高频迁移映射（凭据在源码中的等价依据）：Alert `message`→`title`、`onClose`→`closable={{onClose}}`；Space `direction`→`orientation`；Drawer `width`→`size={number}`；Select `optionFilterProp`→`showSearch.optionFilterProp`；Upload 受控 `fileList` 必须配 `onChange`。

## 数据请求与缓存纪律

- query key 只从 `apps/admin-web/src/api/keys.ts` 的工厂取（前缀即失效域，参数归一化在工厂内）；调用点不拼 key。
- mutation 成功路径调 `src/api/invalidation.ts` 里对应域的 `invalidate*Data(queryClient)`，不集中维护失效清单的写法视为违规。
- 列表/卡片数据三态（空/加载/错误）统一用 `@ai-app/components` 的 `EmptyState`/`LoadingState`/`ErrorState`，页面手写即违规；初次加载用 `LoadingState` 占位形态，有数据后的刷新用带 children 的遮罩形态。

## 子代理协作

- 承重契约（共享包接口、key 结构、失效清单）由主代理先定稿，子代理只填调用方。
- 子代理完成汇报后，主代理验收三件套：grep 确认无残留、`tsc + lint + test` 全量、真实浏览器冒烟关键路径。

## 过程规则

- **页面拆分**：大页面按独立交互单元下刀（弹窗、卡片），不按渲染顺序切；依赖族随行搬走，页面与子组件共用件放域根，禁止子组件反向 import 页面主文件。
- **删除纪律**：删除前先 grep 证明零引用；迁移所有调用方后删除被取代的代码，不留 alias/deprecated/暂时保留。
- **审计台账**：清单落 md，每项四状态（待处理/处理中/已完成带验证/确认不修带理由）；`确认不修`与`已完成`同等重要，防止下轮审计重复提出。
- **冒烟排查**：复现路径依赖具体数据（某条记录、某个按钮）时，脚本先验证前置条件再断言；失败时分层排查——先 harness（选择器、locale、数据作用域），再代码，最后才是产品回归。
