# 迁移前后对比截图清单

## A. 迁移前（JSON）
- [ ] `frontend/server/data/pipeline-ops.json` 总工单数量截图
- [ ] 示例工单（含 executionLogs / impactScope / pumpControls）截图

## B. 迁移执行
- [ ] 命令行执行 `npm run migrate:pipeline-ops` 日志截图
- [ ] 成功/失败统计截图（success/failed）

## C. 迁移后（PostgreSQL）
- [ ] `work_order` 行数截图
- [ ] `work_order_log` 行数截图
- [ ] `order_building_link` 行数截图
- [ ] `pump_control_log` 行数截图
- [ ] 抽样比对：同一工单在 JSON 与 PostgreSQL 的关键字段一致性截图

## D. 前端联调
- [ ] 后台联动看板工单列表截图（分页）
- [ ] 工单详情时间轴截图
- [ ] 影响范围调整日志截图
- [ ] 热水泵控制进度/结果截图
