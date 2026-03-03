# 20条工单全流程测试报告模板

| 序号 | 工单ID | 类型 | 起始状态 | 关键操作步骤 | 预期结果 | 实际结果 | 结论 |
|---|---|---|---|---|---|---|---|
| 1 |  | 巡检 | draft | submit -> assign -> start -> to_review -> approve -> close | 全链路成功 |  |  |
| 2 |  | 维修 | todo | assign -> start -> pause -> resume -> to_review -> approve | 支持暂停恢复 |  |  |
| 3 |  | 改造 | in_progress | reject -> reopen -> to_review | 支持驳回重开 |  |  |
| 4 |  | 巡检 | in_progress | 上传巡检记录（必填项） | 校验通过并落库 |  |  |
| 5 |  | 巡检 | in_progress | 一键转维修 | 新建维修单并带巡检预填 |  |  |
| 6 |  | 联动 | in_progress | 调整影响范围 | JSONB更新+调整日志 |  |  |
| 7 |  | 维修 | in_progress | 批量泵控(open) | 记录前后状态 |  |  |
| 8 |  | 维修 | in_progress | 批量泵控(set_duration) | 倒计时与进度展示 |  |  |
| 9 |  | 任意 | review | reject | 状态变更为rejected |  |  |
| 10 |  | 任意 | paused | resume | 恢复in_progress |  |  |
| 11 |  |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |  |
| 14 |  |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |  |
| 16 |  |  |  |  |  |  |  |
| 17 |  |  |  |  |  |  |  |
| 18 |  |  |  |  |  |  |  |
| 19 |  |  |  |  |  |  |  |
| 20 |  |  |  |  |  |  |  |

## 性能记录
- 20并发列表查询平均响应：
- 拓扑/关联查询平均响应：
- 地图加载耗时：
