-- 管网运维工单测试数据
-- 清理现有数据
DELETE FROM work_order
WHERE id IN (
  'WO-INS-001',
  'WO-INS-002',
  'WO-INS-003',
  'WO-MAI-177',
  'WO-MAI-178',
  'WO-MAI-179',
  'WO-MAI-180',
  'WO-RET-001',
  'WO-RET-002',
  'WO-RET-003',
  'WO-INS-004'
);

-- 1. 巡检工单（已完成）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, linked_workorder_ids, impact_scope) VALUES
('WO-INS-001', '教学区供水管网例行巡检', '对教学区主要供水管道进行例行巡检，检查管道状态、阀门开关、压力表读数等', 'inspection', 'completed', 'medium', 'water', '教学区', '["N-1001","N-1002"]', '["S-2101"]', 'BLD-001', '博学楼', '张三', '李主管', 'manual', '2026-04-10', '2026-04-10 18:00:00+08', '2026-04-10 08:30:00+08', '2026-04-10 16:45:00+08', '["WO-MAI-177"]',
'{"impactedBuildings":[],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}');

-- 2. 巡检工单（进行中）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, impact_scope) VALUES
('WO-INS-002', '图书馆排水系统定期检查', '检查图书馆排水管道是否通畅，清理排水口杂物', 'inspection', 'in_progress', 'low', 'drainage', '生活区', '["N-2001"]', '["S-3101"]', 'BLD-002', '图书馆', '王五', '李主管', 'manual', '2026-04-14', '2026-04-14 18:00:00+08', '2026-04-14 09:00:00+08', '2026-04-14 10:00:00+08',
'{"impactedBuildings":[],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}');

-- 3. 巡检工单（待办）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, impact_scope) VALUES
('WO-INS-003', '实验楼污水管道月度检测', '对实验楼污水管道进行月度检测，确保排放达标', 'inspection', 'todo', 'medium', 'sewage', '教学区', '["N-3001"]', '["S-4101"]', 'BLD-003', '实验楼', '赵六', '李主管', 'manual', '2026-04-15', '2026-04-15 18:00:00+08', '2026-04-14 14:00:00+08', '2026-04-14 14:00:00+08',
'{"impactedBuildings":[],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}');

-- 4. 维修工单（紧急-进行中）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, linked_workorder_ids, impact_scope) VALUES
('WO-MAI-177', '博学楼供水管道漏水抢修', '博学楼3楼供水管道接头处漏水，需要紧急抢修', 'maintenance', 'in_progress', 'urgent', 'water', '教学区', '["N-1002"]', '["S-2102"]', 'BLD-001', '博学楼', '李四', '李主管', 'inspection_transfer', '2026-04-10', '2026-04-11 12:00:00+08', '2026-04-10 10:15:00+08', '2026-04-10 11:30:00+08', '["WO-INS-001"]',
'{"impactedBuildings":[{"buildingId":"BLD-001","buildingName":"博学楼","floors":[3],"rooms":[{"buildingId":"BLD-001","buildingName":"博学楼","floorNo":3,"roomNo":"301","roomId":"R-301","equipmentIds":[]}]}],"bypassRequirement":"需要关闭3楼供水阀门","manualAdjusted":false,"adjustmentLogs":[]}');

-- 5. 维修工单（高优先级-审核中）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, impact_scope) VALUES
('WO-MAI-178', '食堂排水管道堵塞疏通', '食堂厨房排水管道堵塞，导致积水严重', 'maintenance', 'review', 'high', 'drainage', '生活区', '["N-2003"]', '["S-3102"]', 'BLD-004', '学生食堂', '孙七', '李主管', 'anomaly_alert', '2026-04-12', '2026-04-12 20:00:00+08', '2026-04-12 08:00:00+08', '2026-04-12 15:30:00+08',
'{"impactedBuildings":[{"buildingId":"BLD-004","buildingName":"学生食堂","floors":[1],"rooms":[{"buildingId":"BLD-004","buildingName":"学生食堂","floorNo":1,"roomNo":"厨房","roomId":"R-401","equipmentIds":[]}]}],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}');

-- 6. 维修工单（待办）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, impact_scope) VALUES
('WO-MAI-179', '宿舍楼供水管道阀门更换', '6号宿舍楼主供水阀门老化，需要更换', 'maintenance', 'todo', 'medium', 'water', '生活区', '["N-4001"]', '["S-5101"]', 'BLD-005', '6号宿舍楼', '周八', '李主管', 'manual', '2026-04-16', '2026-04-16 18:00:00+08', '2026-04-14 10:00:00+08', '2026-04-14 10:00:00+08',
'{"impactedBuildings":[{"buildingId":"BLD-005","buildingName":"6号宿舍楼","floors":[1,2,3,4,5,6],"rooms":[]}],"bypassRequirement":"需要提前通知住户停水2小时","manualAdjusted":false,"adjustmentLogs":[]}');

-- 7. 维修工单（已完成）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, started_at, finished_at, created_at, updated_at, impact_scope, result_summary) VALUES
('WO-MAI-180', '体育馆供水管道破裂紧急抢修', '体育馆地下供水主管破裂，大量漏水', 'maintenance', 'completed', 'urgent', 'water', '运动区', '["N-5001"]', '["S-6101"]', 'BLD-006', '体育馆', '钱九', '李主管', 'telemetry_alert', '2026-04-08', '2026-04-08 20:00:00+08', '2026-04-08 06:45:00+08', '2026-04-08 18:45:00+08', '2026-04-08 06:30:00+08', '2026-04-08 18:45:00+08',
'{"impactedBuildings":[{"buildingId":"BLD-006","buildingName":"体育馆","floors":[1,2],"rooms":[]}],"bypassRequirement":"启用备用供水管道","manualAdjusted":true,"adjustmentLogs":[{"id":"ADJ-001","adjustedAt":"2026-04-08T07:00:00+08:00","adjustedBy":"钱九","note":"增加影响范围：体育馆全部楼层"}]}',
'管道修复完成，恢复正常供水');

-- 8. 改造工单（进行中）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, deadline_at, started_at, created_at, updated_at, impact_scope) VALUES
('WO-RET-001', '老旧供水管道更新改造', '教学区老旧铸铁管道更换为不锈钢管道', 'retrofit', 'in_progress', 'high', 'water', '教学区', '["N-1001","N-1002","N-1003"]', '["S-2101","S-2102"]', NULL, NULL, '改造项目组', '李主管', 'manual', '2026-04-01', '2026-05-31 18:00:00+08', '2026-04-05 08:00:00+08', '2026-04-01 09:00:00+08', '2026-04-14 09:00:00+08',
'{"impactedBuildings":[{"buildingId":"BLD-001","buildingName":"博学楼","floors":[1,2,3,4],"rooms":[]},{"buildingId":"BLD-003","buildingName":"实验楼","floors":[1,2,3],"rooms":[]}],"bypassRequirement":"分段施工，逐步切换","manualAdjusted":false,"adjustmentLogs":[]}');

-- 9. 改造工单（待办）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, assignee, reviewer, source, planned_date, deadline_at, created_at, updated_at, impact_scope) VALUES
('WO-RET-002', '雨污分流改造工程', '生活区雨污分流改造，新建雨水管道', 'retrofit', 'todo', 'medium', 'mixed', '生活区', '["N-6001","N-6002"]', '["S-7101","S-7102"]', '市政工程队', '李主管', 'manual', '2026-05-01', '2026-06-30 18:00:00+08', '2026-04-14 10:00:00+08', '2026-04-14 10:00:00+08',
'{"impactedBuildings":[{"buildingId":"BLD-004","buildingName":"学生食堂","floors":[1],"rooms":[]},{"buildingId":"BLD-005","buildingName":"6号宿舍楼","floors":[1,2,3,4,5,6],"rooms":[]}],"bypassRequirement":"保持现有排水系统运行","manualAdjusted":false,"adjustmentLogs":[]}');

-- 9.1 多楼宇影响关联
INSERT INTO order_building_link (work_order_id, building_id, building_name, floor_nos, room_refs, source, is_manual_adjusted) VALUES
('WO-RET-001', 'BLD-001', '博学楼', '[1,2,3,4]', '[]', 'impact', false),
('WO-RET-001', 'BLD-003', '实验楼', '[1,2,3]', '[]', 'impact', false),
('WO-RET-002', 'BLD-004', '学生食堂', '[1]', '[]', 'impact', false),
('WO-RET-002', 'BLD-005', '6号宿舍楼', '[1,2,3,4,5,6]', '[]', 'impact', false);

-- 10. 报废工单（已完成）
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, assignee, reviewer, source, planned_date, deadline_at, started_at, finished_at, created_at, updated_at, impact_scope, result_summary) VALUES
('WO-RET-003', '废弃管道封堵处理', '旧教学楼拆除后的废弃供水管道封堵', 'retire', 'completed', 'low', 'water', '教学区', '["N-7001"]', '["S-8101"]', '吴十', '李主管', 'manual', '2026-04-05', '2026-04-05 18:00:00+08', '2026-04-05 09:00:00+08', '2026-04-05 17:00:00+08', '2026-04-03 10:00:00+08', '2026-04-05 17:00:00+08',
'{"impactedBuildings":[],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}',
'封堵完成，管道已废弃');

-- 11. 草稿工单
INSERT INTO work_order (id, title, description, order_type, status, priority, pipeline_medium, area, node_ids, segment_ids, building_id, building_name, assignee, reviewer, source, planned_date, created_at, updated_at, impact_scope) VALUES
('WO-INS-004', '行政楼供水系统季度检查', '对行政楼供水系统进行季度全面检查', 'inspection', 'draft', 'low', 'water', '行政区', '["N-8001"]', '["S-9101"]', 'BLD-007', '行政楼', '郑十一', '李主管', 'manual', '2026-04-20', '2026-04-14 15:00:00+08', '2026-04-14 15:00:00+08',
'{"impactedBuildings":[],"bypassRequirement":"无需旁路","manualAdjusted":false,"adjustmentLogs":[]}');
