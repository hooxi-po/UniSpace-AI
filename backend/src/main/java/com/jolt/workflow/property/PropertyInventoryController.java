package com.jolt.workflow.property;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/property/inventory")
public class PropertyInventoryController {

    private final JdbcTemplate jdbcTemplate;

    public PropertyInventoryController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/tasks")
    public Map<String, Object> listTasks(
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "keyword", required = false) String keyword
    ) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, task_no, year_no, task_name, building_code, building_name, scope, owner_dept, leader,
                       due_date, status, phase, progress, checked_assets, total_assets, discrepancy_count, last_updated_at
                FROM property_inventory_tasks
                WHERE 1=1
                """);

        List<Object> params = new ArrayList<>();

        if (year != null) {
            sql.append(" AND year_no = ? ");
            params.add(year);
        }
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            sql.append(" AND status = ? ");
            params.add(status);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (task_no ILIKE ? OR task_name ILIKE ? OR building_name ILIKE ? OR owner_dept ILIKE ? OR leader ILIKE ?) ");
            String kw = "%" + keyword.trim() + "%";
            params.add(kw);
            params.add(kw);
            params.add(kw);
            params.add(kw);
            params.add(kw);
        }

        sql.append(" ORDER BY year_no DESC, due_date ASC, id DESC ");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        List<Map<String, Object>> items = rows.stream().map(this::toTaskView).toList();

        return Map.of(
                "source", "postgres",
                "items", items
        );
    }

    @GetMapping("/tasks/{id}")
    public Map<String, Object> taskDetail(@PathVariable("id") Long id) {
        List<Map<String, Object>> tasks = jdbcTemplate.queryForList("""
                SELECT id, task_no, year_no, task_name, building_code, building_name, scope, owner_dept, leader,
                       due_date, status, phase, progress, checked_assets, total_assets, discrepancy_count, last_updated_at
                FROM property_inventory_tasks
                WHERE id = ?
                """, id);

        if (tasks.isEmpty()) {
            throw new IllegalArgumentException("inventory_task_not_found");
        }

        Map<String, Object> task = toTaskView(tasks.get(0));

        List<Map<String, Object>> discrepancies = jdbcTemplate.queryForList("""
                SELECT
                    id::text AS id,
                    issue_no AS "issueNo",
                    asset_code AS "assetCode",
                    asset_name AS "assetName",
                    location,
                    problem_type AS "problemType",
                    severity,
                    suggestion,
                    discovered_at AS "discoveredAt",
                    reviewer
                FROM property_inventory_discrepancies
                WHERE task_id = ?
                ORDER BY discovered_at DESC, id DESC
                """, id);

        return Map.of(
                "source", "postgres",
                "data", Map.of(
                        "task", task,
                        "discrepancies", discrepancies
                )
        );
    }

    @PatchMapping("/tasks/{id}/start-review")
    public Map<String, Object> startReview(@PathVariable("id") Long id) {
        Map<String, Object> task = getTaskRow(id);
        if (task == null) {
            throw new IllegalArgumentException("inventory_task_not_found");
        }

        String status = text(task.get("status"));
        int progress = intVal(task.get("progress"));

        boolean allow = ("进行中".equals(status) && progress >= 80) || "待复核".equals(status);
        if (!allow) {
            throw new IllegalArgumentException("start_review_not_allowed");
        }

        jdbcTemplate.update("""
                UPDATE property_inventory_tasks
                SET status = '待复核',
                    phase = '差异复核',
                    progress = GREATEST(progress, 90),
                    last_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
                """, id);

        return Map.of(
                "ok", true,
                "data", toTaskView(requireTaskRow(id))
        );
    }

    @PatchMapping("/tasks/{id}/archive")
    public Map<String, Object> archive(@PathVariable("id") Long id) {
        Map<String, Object> task = getTaskRow(id);
        if (task == null) {
            throw new IllegalArgumentException("inventory_task_not_found");
        }

        String status = text(task.get("status"));
        String phase = text(task.get("phase"));
        int progress = intVal(task.get("progress"));

        boolean allow = ("待复核".equals(status) && progress >= 90) || "结果归档".equals(phase);
        if (!allow) {
            throw new IllegalArgumentException("archive_not_allowed");
        }

        jdbcTemplate.update("""
                UPDATE property_inventory_tasks
                SET status = '已完成',
                    phase = '结果归档',
                    progress = 100,
                    last_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
                """, id);

        return Map.of(
                "ok", true,
                "data", toTaskView(requireTaskRow(id))
        );
    }

    private Map<String, Object> getTaskRow(Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, task_no, year_no, task_name, building_code, building_name, scope, owner_dept, leader,
                       due_date, status, phase, progress, checked_assets, total_assets, discrepancy_count, last_updated_at
                FROM property_inventory_tasks
                WHERE id = ?
                """, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> requireTaskRow(Long id) {
        Map<String, Object> row = getTaskRow(id);
        if (row == null) {
            throw new IllegalArgumentException("inventory_task_not_found");
        }
        return row;
    }

    private Map<String, Object> toTaskView(Map<String, Object> row) {
        String status = text(row.get("status"));
        String phase = text(row.get("phase"));
        int progress = intVal(row.get("progress"));

        boolean canStartReview = ("进行中".equals(status) && progress >= 80) || "待复核".equals(status);
        boolean canArchive = ("待复核".equals(status) && progress >= 90) || "结果归档".equals(phase);

        String reason = "";
        if (!canStartReview && !canArchive) {
            reason = "当前任务阶段不满足操作条件";
        } else if (!canStartReview) {
            reason = "需先进入复核阶段";
        } else if (!canArchive) {
            reason = "需先完成复核后归档";
        }

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("id", String.valueOf(row.get("id")));
        result.put("year", intVal(row.get("year_no")));
        result.put("taskName", text(row.get("task_name")));
        result.put("buildingCode", text(row.get("building_code")));
        result.put("building", text(row.get("building_name")));
        result.put("scope", text(row.get("scope")));
        result.put("ownerDept", text(row.get("owner_dept")));
        result.put("leader", text(row.get("leader")));
        result.put("dueDate", String.valueOf(row.get("due_date")));
        result.put("status", status);
        result.put("phase", phase);
        result.put("progress", progress);
        result.put("checkedAssets", intVal(row.get("checked_assets")));
        result.put("totalAssets", intVal(row.get("total_assets")));
        result.put("discrepancyCount", intVal(row.get("discrepancy_count")));
        result.put("lastUpdatedAt", String.valueOf(row.get("last_updated_at")));
        result.put("permissions", Map.of(
                "canStartReview", canStartReview,
                "canArchive", canArchive,
                "reason", reason
        ));
        return result;
    }

    private int intVal(Object value) {
        if (value == null) return 0;
        return Integer.parseInt(String.valueOf(value));
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}