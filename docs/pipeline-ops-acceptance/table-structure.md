# PostgreSQL 表结构说明（管道运维闭环）

## 1. work_order
- 主键：`id`
- 核心字段：`order_type`、`status`、`pipeline_medium`、`priority`、`area`
- 业务JSONB：`topology_chain`、`node_ids`、`segment_ids`、`impact_scope`、`inspection_payload`、`maintenance_payload`
- 时间字段：`created_at`、`updated_at`、`started_at`、`finished_at`、`closed_at`、`paused_at`、`rejected_at`
- 索引：状态、类型、区域、执行人、楼宇、创建时间、节点/管段GIN索引、影响范围GIN索引

## 2. order_building_link
- 主键：`id`（bigserial）
- 外键：`work_order_id -> work_order.id`
- 作用：保存工单与受影响楼宇/楼层/房间关联
- 字段：`building_id`、`building_name`、`floor_nos(jsonb)`、`room_refs(jsonb)`、`is_manual_adjusted`
- 索引：`work_order_id`、`building_id`、`source`、楼层/房间GIN索引

## 3. work_order_log
- 主键：`id`
- 外键：`work_order_id -> work_order.id`
- 作用：记录工单执行过程时间轴（创建、流转、异常、验收、联动）
- 字段：`stage`、`content`、`actor`、`location(jsonb)`、`photo_urls(jsonb)`、`node_id`
- 索引：`work_order_id + created_at`、`stage`、`actor`、`node_id`

## 4. pump_control_log
- 主键：`id`
- 外键：`work_order_id -> work_order.id`
- 作用：记录热水泵控制过程、前后状态、进度、倒计时
- 字段：`action`、`result`、`before_status`、`after_status`、`countdown_seconds`、`progress_percent`
- 索引：`work_order_id + executed_at`、`building_id`、`result`
