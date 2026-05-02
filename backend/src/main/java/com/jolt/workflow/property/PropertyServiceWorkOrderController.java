package com.jolt.workflow.property;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/property/service-workorders")
public class PropertyServiceWorkOrderController {

    private final JdbcTemplate jdbcTemplate;

    public PropertyServiceWorkOrderController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "priority", required = false) String priority,
            @RequestParam(name = "limit", defaultValue = "500") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 2000));
        int safeOffset = Math.max(0, offset);

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (keyword != null && !keyword.isBlank()) {
            where.append(" AND (workorder_no ILIKE ? OR room_label ILIKE ? OR reporter ILIKE ? OR asset_name ILIKE ?) ");
            String kw = "%" + keyword.trim() + "%";
            params.add(kw); params.add(kw); params.add(kw); params.add(kw);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND status = ? ");
            params.add(status);
        }
        if (priority != null && !priority.isBlank()) {
            where.append(" AND priority = ? ");
            params.add(priority);
        }

        String sql = "SELECT * FROM property_service_workorders " + where +
                " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.add(safeLimit);
        params.add(safeOffset);

        List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
        return Map.of("source", "postgres", "items", items, "limit", safeLimit, "offset", safeOffset);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String workorderNo = "WO-" + System.currentTimeMillis();
        jdbcTemplate.update(
                "INSERT INTO property_service_workorders(workorder_no, room_id, room_label, asset_name, fault_desc, priority, status, reporter, report_phone) " +
                        "VALUES (?,?,?,?,?,'中','待派单',?,?)",
                workorderNo,
                text(body.get("roomId")),
                text(body.get("roomLabel")),
                text(body.get("assetName")),
                text(body.get("faultDesc")),
                text(body.get("reporter")),
                nullable(body.get("reportPhone"))
        );
        Long id = jdbcTemplate.queryForObject(
                "SELECT id FROM property_service_workorders WHERE workorder_no = ?",
                Long.class,
                workorderNo
        );
        insertLog(id, "创建工单", "工单已创建", text(body.get("reporter")));
        return Map.of("ok", true, "id", id);
    }

    @PatchMapping("/{id}/assign")
    public Map<String, Object> assign(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        jdbcTemplate.update(
                "UPDATE property_service_workorders SET team_name=?, assignee=?, plan_arrival_at=?, status='已派单', updated_at=NOW() WHERE id=?",
                text(body.get("teamName")),
                text(body.get("assignee")),
                nullable(body.get("planArrivalAt")),
                id
        );
        insertLog(id, "派工", "已分配维修队伍", text(body.get("operatorName")));
        return Map.of("ok", true);
    }

    @PatchMapping("/{id}/status")
    public Map<String, Object> updateStatus(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        String status = text(body.get("status"));
        if ("已完成".equals(status)) {
            jdbcTemplate.update(
                    "UPDATE property_service_workorders SET status=?, finished_at=NOW(), updated_at=NOW() WHERE id=?",
                    status, id
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE property_service_workorders SET status=?, updated_at=NOW() WHERE id=?",
                    status, id
            );
        }
        insertLog(id, "状态变更", "变更为：" + status, text(body.get("operatorName")));
        return Map.of("ok", true);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable("id") Long id) {
        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                "SELECT * FROM property_service_workorders WHERE id = ?",
                id
        );
        if (items.isEmpty()) {
            throw new IllegalArgumentException("workorder_not_found");
        }
        List<Map<String, Object>> logs = jdbcTemplate.queryForList(
                "SELECT * FROM property_service_workorder_logs WHERE workorder_id = ? ORDER BY created_at DESC",
                id
        );
        return Map.of("item", items.get(0), "logs", logs);
    }

    private void insertLog(Long workorderId, String action, String detail, String operator) {
        jdbcTemplate.update(
                "INSERT INTO property_service_workorder_logs(workorder_id, action, detail, operator_name, created_at) VALUES (?,?,?,?,?)",
                workorderId, action, detail, operator, LocalDateTime.now()
        );
    }

    private String text(Object o) {
        return String.valueOf(o == null ? "" : o).trim();
    }

    private Object nullable(Object o) {
        String s = text(o);
        return s.isBlank() ? null : s;
    }
}