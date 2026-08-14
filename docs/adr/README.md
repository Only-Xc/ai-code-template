# ADR 状态说明

ADR 用于记录重要架构决策，不记录普通任务进度。

## 状态

- `proposed`：已提出，尚未接受。
- `accepted`：当前有效决策。
- `deprecated`：不再推荐用于新代码，但可能仍有历史实现。
- `superseded`：已被新 ADR 替代，正文必须链接替代 ADR。

## 编号规则

- 文件名格式：`NNNN-kebab-case-title.md`。
- 编号递增，不复用删除或废弃 ADR 的编号。

## 维护规则

- 涉及依赖装配、事务、错误格式、模块边界、CI、部署方式的变化必须写 ADR。
- 变更已接受决策时，新建 ADR，不直接重写历史结论。
- 被替代的 ADR 需更新状态为 `superseded` 并指向新 ADR。
