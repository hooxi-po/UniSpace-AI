package com.jolt.workflow.pipelineops;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class WorkOrderRepository {

    private static final Set<String> ORDER_TYPES = Set.of("inspection", "maintenance", "retrofit", "retire");
    private static final Set<String> ORDER_STATUS = Set.of(
            "draft", "todo", "assigned", "in_progress", "paused", "review", "completed", "closed", "cancelled", "rejected"
    );
    private static final Set<String> ORDER_PRIORITY = Set.of("low", "medium", "high", "urgent");
    private static final Set<String> ORDER_MEDIUM = Set.of("water", "drainage", "sewage", "mixed");
    private static final Set<String> ORDER_SOURCE = Set.of(
            "manual", "telemetry_alert", "anomaly_alert", "kg_inference", "inspection_transfer"
    );

    private static final long CACHE_TTL_MS = 5L * 60L * 1000L;
    private static final int MAX_CACHE_ENTRIES = 1000;
    private static final int CACHE_CLEANUP_BATCH = 128;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 200;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private static final Map<String, List<BuildingSeed>> TOPOLOGY_IMPACT_INDEX = Map.ofEntries(
            Map.entry("N-1001", List.of(new BuildingSeed("BLD-001", "博学楼"))),
            Map.entry("N-1002", List.of(new BuildingSeed("BLD-001", "博学楼"))),
            Map.entry("N-2301", List.of(new BuildingSeed("BLD-002", "综合实验楼"))),
            Map.entry("N-5011", List.of(new BuildingSeed("BLD-003", "学生宿舍楼"))),
            Map.entry("N-5012", List.of(new BuildingSeed("BLD-003", "学生宿舍楼"))),
            Map.entry("N-8801", List.of(new BuildingSeed("BLD-004", "创新创业中心"))),
            Map.entry("S-2101", List.of(new BuildingSeed("BLD-001", "博学楼"))),
            Map.entry("S-4302", List.of(new BuildingSeed("BLD-002", "综合实验楼"))),
            Map.entry("S-4303", List.of(new BuildingSeed("BLD-002", "综合实验楼"))),
            Map.entry("S-6101", List.of(new BuildingSeed("BLD-003", "学生宿舍楼"))),
            Map.entry("S-9921", List.of(new BuildingSeed("BLD-004", "创新创业中心")))
    );

    public WorkOrderRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public ObjectNode listWorkorders(PipelineOrderListQuery query) {
        String cacheKey = "list:" + query.cacheKey();
        JsonNode cached = readCache(cacheKey);
        if (cached != null && cached.isObject()) {
            return (ObjectNode) cached;
        }

        QueryFilter filter = buildQueryFilter(query, "w");

        Integer total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM work_order w" + filter.whereSql(),
                filter.params().toArray(),
                Integer.class
        );

        int safeLimit = clamp(query.limit(), 1, MAX_LIMIT, DEFAULT_LIMIT);
        int safePage = Math.max(1, query.page());
        int safeOffset = (safePage - 1) * safeLimit;

        List<Object> listParams = new ArrayList<>(filter.params());
        listParams.add(safeLimit);
        listParams.add(safeOffset);

        String listSql = "SELECT w.*, " +
                "COALESCE((SELECT jsonb_agg(jsonb_build_object(" +
                "'id', l.id, 'stage', l.stage, 'content', l.content, 'actor', l.actor, 'createdAt', l.created_at, " +
                "'location', l.location, 'photoUrls', l.photo_urls, 'voiceUrl', COALESCE(l.voice_url, ''), " +
                "'nodeId', COALESCE(l.node_id, ''), 'isMobileUpload', l.is_mobile_upload" +
                ") ORDER BY l.created_at ASC) FROM work_order_log l WHERE l.work_order_id = w.id), '[]'::jsonb) AS execution_logs, " +
                "COALESCE((SELECT jsonb_agg(jsonb_build_object(" +
                "'id', p.id, 'buildingId', p.building_id, 'buildingName', p.building_name, 'pumpId', p.pump_id, " +
                "'action', p.action, 'durationMinutes', p.duration_minutes, 'result', p.result, " +
                "'beforeStatus', COALESCE(p.before_status, ''), 'afterStatus', COALESCE(p.after_status, ''), " +
                "'countdownSeconds', p.countdown_seconds, 'batchTotal', p.batch_total, 'batchIndex', p.batch_index, " +
                "'progressPercent', p.progress_percent, 'executedAt', p.executed_at, 'executedBy', p.executed_by, " +
                "'message', COALESCE(p.message, '')" +
                ") ORDER BY p.executed_at ASC) FROM pump_control_log p WHERE p.work_order_id = w.id), '[]'::jsonb) AS pump_controls " +
                "FROM work_order w" + filter.whereSql() +
                " ORDER BY w.updated_at DESC LIMIT ? OFFSET ?";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(listSql, listParams.toArray());

        ArrayNode list = objectMapper.createArrayNode();
        for (Map<String, Object> row : rows) {
            list.add(mapWorkOrder(row));
        }

        int finalTotal = total == null ? 0 : total;
        int totalPages = finalTotal == 0 ? 0 : (int) Math.ceil((double) finalTotal / safeLimit);

        ObjectNode root = objectMapper.createObjectNode();
        root.set("list", list);
        ObjectNode pagination = objectMapper.createObjectNode();
        pagination.put("page", safePage);
        pagination.put("limit", safeLimit);
        pagination.put("offset", safeOffset);
        pagination.put("total", finalTotal);
        pagination.put("totalPages", totalPages);
        root.set("pagination", pagination);

        saveCache(cacheKey, root);
        return root;
    }

    public ObjectNode getWorkorder(String id) {
        Map<String, Object> row = jdbcTemplate.query(
                "SELECT w.*, " +
                        "COALESCE((SELECT jsonb_agg(jsonb_build_object(" +
                        "'id', l.id, 'stage', l.stage, 'content', l.content, 'actor', l.actor, 'createdAt', l.created_at, " +
                        "'location', l.location, 'photoUrls', l.photo_urls, 'voiceUrl', COALESCE(l.voice_url, ''), " +
                        "'nodeId', COALESCE(l.node_id, ''), 'isMobileUpload', l.is_mobile_upload" +
                        ") ORDER BY l.created_at ASC) FROM work_order_log l WHERE l.work_order_id = w.id), '[]'::jsonb) AS execution_logs, " +
                        "COALESCE((SELECT jsonb_agg(jsonb_build_object(" +
                        "'id', p.id, 'buildingId', p.building_id, 'buildingName', p.building_name, 'pumpId', p.pump_id, " +
                        "'action', p.action, 'durationMinutes', p.duration_minutes, 'result', p.result, " +
                        "'beforeStatus', COALESCE(p.before_status, ''), 'afterStatus', COALESCE(p.after_status, ''), " +
                        "'countdownSeconds', p.countdown_seconds, 'batchTotal', p.batch_total, 'batchIndex', p.batch_index, " +
                        "'progressPercent', p.progress_percent, 'executedAt', p.executed_at, 'executedBy', p.executed_by, " +
                        "'message', COALESCE(p.message, '')" +
                        ") ORDER BY p.executed_at ASC) FROM pump_control_log p WHERE p.work_order_id = w.id), '[]'::jsonb) AS pump_controls " +
                        "FROM work_order w WHERE w.id = ?",
                ps -> ps.setString(1, id),
                rs -> {
                    if (!rs.next()) return null;
                    Map<String, Object> m = new HashMap<>();
                    for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                        m.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
                    }
                    return m;
                }
        );
        if (row == null) return null;
        return mapWorkOrder(row);
    }

    @Transactional
    public ObjectNode upsertWorkorder(JsonNode body) {
        String id = text(body.get("id"));
        if (id == null || id.isBlank()) {
            id = nextWorkorderId(text(body.get("type")));
        }
        String title = text(body.get("title"));
        if (title == null || title.isBlank()) {
            throw badRequest("title_required");
        }

        ObjectNode existing = getWorkorder(id);
        boolean isNew = existing == null;
        ObjectNode normalized = normalizeWorkOrderInput(body, existing, id, isNew);

        jdbcTemplate.update(
                "INSERT INTO work_order (" +
                        "id, title, description, order_type, source, status, pipeline_medium, priority, area, " +
                        "topology_chain, node_ids, segment_ids, building_id, building_name, room_ids, equipment_ids, " +
                        "assignee, reviewer, planned_date, deadline_at, started_at, reviewed_at, finished_at, closed_at, paused_at, rejected_at, " +
                        "result_summary, linked_workorder_ids, impact_scope, inspection_payload, maintenance_payload, retrofit_payload, retire_payload, notifications, created_by, created_at, updated_at" +
                        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?::date, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?::timestamptz, ?::timestamptz) " +
                        "ON CONFLICT (id) DO UPDATE SET " +
                        "title = EXCLUDED.title, description = EXCLUDED.description, order_type = EXCLUDED.order_type, source = EXCLUDED.source, " +
                        "status = EXCLUDED.status, pipeline_medium = EXCLUDED.pipeline_medium, priority = EXCLUDED.priority, area = EXCLUDED.area, " +
                        "topology_chain = EXCLUDED.topology_chain, node_ids = EXCLUDED.node_ids, segment_ids = EXCLUDED.segment_ids, building_id = EXCLUDED.building_id, building_name = EXCLUDED.building_name, " +
                        "room_ids = EXCLUDED.room_ids, equipment_ids = EXCLUDED.equipment_ids, assignee = EXCLUDED.assignee, reviewer = EXCLUDED.reviewer, " +
                        "planned_date = EXCLUDED.planned_date, deadline_at = EXCLUDED.deadline_at, started_at = EXCLUDED.started_at, reviewed_at = EXCLUDED.reviewed_at, finished_at = EXCLUDED.finished_at, " +
                        "closed_at = EXCLUDED.closed_at, paused_at = EXCLUDED.paused_at, rejected_at = EXCLUDED.rejected_at, result_summary = EXCLUDED.result_summary, linked_workorder_ids = EXCLUDED.linked_workorder_ids, " +
                        "impact_scope = EXCLUDED.impact_scope, inspection_payload = EXCLUDED.inspection_payload, maintenance_payload = EXCLUDED.maintenance_payload, retrofit_payload = EXCLUDED.retrofit_payload, " +
                        "retire_payload = EXCLUDED.retire_payload, notifications = EXCLUDED.notifications, created_by = EXCLUDED.created_by, updated_at = EXCLUDED.updated_at",
                normalized.get("id").asText(),
                normalized.get("title").asText(),
                normalized.path("description").asText(""),
                normalized.get("type").asText(),
                normalized.get("source").asText(),
                normalized.get("status").asText(),
                normalized.get("pipelineMedium").asText(),
                normalized.get("priority").asText(),
                normalized.get("area").asText(),
                jsonText(normalized.get("topologyChain")),
                jsonText(normalized.get("nodeIds")),
                jsonText(normalized.get("segmentIds")),
                nullableText(normalized.get("buildingId")),
                nullableText(normalized.get("buildingName")),
                jsonText(normalized.get("roomIds")),
                jsonText(normalized.get("equipmentIds")),
                nullableText(normalized.get("assignee")),
                nullableText(normalized.get("reviewer")),
                nullableDate(normalized.get("plannedDate"), "plannedDate"),
                nullableTimestamp(normalized.get("deadlineAt"), "deadlineAt"),
                nullableTimestamp(normalized.get("startedAt"), "startedAt"),
                nullableTimestamp(normalized.get("reviewedAt"), "reviewedAt"),
                nullableTimestamp(normalized.get("finishedAt"), "finishedAt"),
                nullableTimestamp(normalized.get("closedAt"), "closedAt"),
                nullableTimestamp(normalized.get("pausedAt"), "pausedAt"),
                nullableTimestamp(normalized.get("rejectedAt"), "rejectedAt"),
                normalized.path("resultSummary").asText(""),
                jsonText(normalized.get("linkedWorkorderIds")),
                jsonText(normalized.get("impactScope")),
                jsonText(normalized.get("inspection")),
                jsonText(normalized.get("maintenance")),
                jsonText(normalized.get("retrofit")),
                jsonText(normalized.get("retire")),
                jsonText(normalized.get("notifications")),
                normalized.get("createdBy").asText(),
                nullableTimestamp(normalized.get("createdAt"), "createdAt"),
                nullableTimestamp(normalized.get("updatedAt"), "updatedAt")
        );

        syncBuildingLinks(
                normalized.get("id").asText(),
                normalized.path("impactScope").path("impactedBuildings"),
                normalized.path("impactScope").path("manualAdjusted").asBoolean(false)
        );

        if (isNew) {
            ArrayNode providedLogs = array(body.get("executionLogs"));
            if (providedLogs.isEmpty()) {
                insertExecutionLog(normalized.get("id").asText(), createDefaultCreatedLog(normalized));
            } else {
                for (JsonNode log : providedLogs) {
                    insertExecutionLog(normalized.get("id").asText(), normalizeExecutionLog(log, normalized.get("createdBy").asText()));
                }
            }
            ArrayNode providedPump = array(body.get("pumpControls"));
            for (JsonNode p : providedPump) {
                insertPumpControlLog(normalized.get("id").asText(), normalizePumpControlLog(p, normalized.get("createdBy").asText(), providedPump.size(), true), true);
            }
        }

        invalidateCache();
        ObjectNode workorder = getWorkorder(id);
        if (workorder == null) throw badRequest("upsert_failed");
        return workorder;
    }

    @Transactional
    public ObjectNode transitionWorkorder(JsonNode body) {
        String id = text(body.get("id"));
        String action = text(body.get("action"));
        if (id == null || id.isBlank()) throw badRequest("id_required");
        if (action == null || action.isBlank()) throw badRequest("action_required");

        ObjectNode current = getWorkorder(id);
        if (current == null) throw notFound("workorder_not_found");

        String currentStatus = current.path("status").asText("draft");
        if (!isValidTransition(currentStatus, action)) {
            throw badRequest("invalid_transition");
        }

        String actor = defaultText(text(body.get("actor")), defaultText(text(body.get("assignee")), "admin-ui"));
        String now = OffsetDateTime.now().toString();
        String nextStatus = currentStatus;

        ObjectNode updates = current.deepCopy();
        updates.put("updatedAt", now);
        if (body.has("resultSummary") && !body.get("resultSummary").isNull()) {
            updates.put("resultSummary", text(body.get("resultSummary")) == null ? "" : text(body.get("resultSummary")));
        }

        switch (action) {
            case "submit" -> nextStatus = "todo";
            case "assign" -> {
                nextStatus = "assigned";
                String nextAssignee = defaultText(text(body.get("assignee")), updates.path("assignee").asText(""));
                if (nextAssignee.isBlank()) throw badRequest("assignee_required");
                updates.put("assignee", nextAssignee);
                if (text(body.get("reviewer")) != null) updates.put("reviewer", text(body.get("reviewer")));
            }
            case "start" -> {
                nextStatus = "in_progress";
                if (isBlank(textValue(current.get("startedAt")))) updates.put("startedAt", now);
            }
            case "pause" -> {
                nextStatus = "paused";
                updates.put("pausedAt", now);
            }
            case "resume" -> nextStatus = "in_progress";
            case "to_review" -> {
                nextStatus = "review";
                updates.put("reviewedAt", now);
            }
            case "approve" -> {
                nextStatus = "completed";
                updates.put("finishedAt", now);
            }
            case "close" -> {
                nextStatus = "closed";
                updates.put("closedAt", now);
            }
            case "cancel" -> {
                nextStatus = "cancelled";
                updates.put("closedAt", now);
            }
            case "reject" -> {
                nextStatus = "rejected";
                updates.put("rejectedAt", now);
                updates.put("closedAt", now);
            }
            case "reopen" -> {
                nextStatus = shouldReopenToTodo(currentStatus) ? "todo" : "in_progress";
                updates.put("reviewedAt", "");
                updates.put("finishedAt", "");
                updates.put("closedAt", "");
                updates.put("rejectedAt", "");
                updates.put("pausedAt", "");
            }
            default -> throw badRequest("invalid_action");
        }

        updates.put("status", nextStatus);

        jdbcTemplate.update(
                "UPDATE work_order SET status = ?, assignee = ?, reviewer = ?, result_summary = ?, started_at = ?::timestamptz, reviewed_at = ?::timestamptz, finished_at = ?::timestamptz, closed_at = ?::timestamptz, paused_at = ?::timestamptz, rejected_at = ?::timestamptz, updated_at = ?::timestamptz WHERE id = ?",
                nextStatus,
                nullableText(updates.get("assignee")),
                nullableText(updates.get("reviewer")),
                updates.path("resultSummary").asText(""),
                nullableTimestamp(updates.get("startedAt"), "startedAt"),
                nullableTimestamp(updates.get("reviewedAt"), "reviewedAt"),
                nullableTimestamp(updates.get("finishedAt"), "finishedAt"),
                nullableTimestamp(updates.get("closedAt"), "closedAt"),
                nullableTimestamp(updates.get("pausedAt"), "pausedAt"),
                nullableTimestamp(updates.get("rejectedAt"), "rejectedAt"),
                now,
                id
        );

        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", newLogId("LOG"));
        log.put("stage", "status_change");
        log.put("content", "状态流转：" + currentStatus + " -> " + nextStatus + withComment(text(body.get("comment"))));
        log.put("actor", actor);
        log.put("createdAt", now);
        log.set("location", objectMapper.nullNode());
        log.set("photoUrls", objectMapper.createArrayNode());
        log.put("voiceUrl", "");
        log.put("nodeId", "");
        log.put("isMobileUpload", false);
        insertExecutionLog(id, log);

        invalidateCache();
        ObjectNode next = getWorkorder(id);
        if (next == null) throw notFound("workorder_not_found");
        return next;
    }

    @Transactional
    public ObjectNode autoCreate(JsonNode body) {
        String trigger = text(body.get("trigger"));
        String reason = text(body.get("reason"));
        JsonNode base = body.get("base");
        if (trigger == null || reason == null || base == null || !base.isObject()) {
            throw badRequest("trigger_reason_base_required");
        }

        ObjectNode payload = ((ObjectNode) base).deepCopy();
        payload.put("source", trigger);
        payload.put("createdBy", "system");
        ObjectNode autoTrigger = objectMapper.createObjectNode();
        autoTrigger.put("source", trigger);
        autoTrigger.put("reason", reason);
        if (base.has("priority") && !base.get("priority").isNull()) {
            autoTrigger.put("severity", text(base.get("priority")));
        }
        payload.set("autoTrigger", autoTrigger);
        return upsertWorkorder(payload);
    }

    @Transactional
    public ObjectNode handleAction(JsonNode body) {
        String action = text(body.get("action"));
        JsonNode payload = body.get("payload");
        if (action == null || payload == null || !payload.isObject()) throw badRequest("action_payload_required");

        return switch (action) {
            case "add_log" -> actionAddLog((ObjectNode) payload);
            case "adjust_impact" -> actionAdjustImpact((ObjectNode) payload);
            case "pump_control" -> actionPumpControl((ObjectNode) payload);
            case "add_inspection_record" -> actionAddInspectionRecord((ObjectNode) payload);
            case "convert_to_maintenance" -> actionConvertToMaintenance((ObjectNode) payload);
            default -> throw badRequest("unsupported_action");
        };
    }

    public ObjectNode getStats(PipelineOrderListQuery query) {
        String cacheKey = buildSummaryCacheKey("stats", query);
        JsonNode cached = readCache(cacheKey);
        if (cached != null && cached.isObject()) {
            return (ObjectNode) cached;
        }

        QueryFilter filter = buildQueryFilter(query, "w");
        ObjectNode stats = objectMapper.createObjectNode();
        Integer total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM work_order w" + filter.whereSql(),
                filter.params().toArray(),
                Integer.class
        );
        stats.put("total", total == null ? 0 : total);

        for (String status : ORDER_STATUS) {
            List<Object> params = new ArrayList<>(filter.params());
            params.add(status);
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM work_order w" + filter.whereSql() + " AND w.status = ?",
                    params.toArray(),
                    Integer.class
            );
            stats.put(status, count == null ? 0 : count);
        }
        stats.put("inProgress", stats.path("in_progress").asInt(0));

        saveCache(cacheKey, stats);
        return stats;
    }

    public ObjectNode getDashboard(PipelineOrderListQuery query) {
        String cacheKey = buildSummaryCacheKey("dashboard", query);
        JsonNode cached = readCache(cacheKey);
        if (cached != null && cached.isObject()) {
            return (ObjectNode) cached;
        }

        QueryFilter filter = buildQueryFilter(query, "w");
        ObjectNode dashboard = objectMapper.createObjectNode();

        ObjectNode totalsByType = objectMapper.createObjectNode();
        for (String orderTypeName : ORDER_TYPES) {
            List<Object> params = new ArrayList<>(filter.params());
            params.add(orderTypeName);
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM work_order w" + filter.whereSql() + " AND w.order_type = ?",
                    params.toArray(),
                    Integer.class
            );
            totalsByType.put(orderTypeName, count == null ? 0 : count);
        }
        dashboard.set("totalsByType", totalsByType);

        ObjectNode totalsByStatus = objectMapper.createObjectNode();
        for (String status : ORDER_STATUS) {
            List<Object> params = new ArrayList<>(filter.params());
            params.add(status);
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM work_order w" + filter.whereSql() + " AND w.status = ?",
                    params.toArray(),
                    Integer.class
            );
            totalsByStatus.put(status, count == null ? 0 : count);
        }
        dashboard.set("totalsByStatus", totalsByStatus);

        ArrayNode topBuildings = objectMapper.createArrayNode();
        List<Object> topBuildingParams = new ArrayList<>(filter.params());
        StringBuilder topBuildingsSql = new StringBuilder(
                "SELECT COALESCE(obl.building_name, w.building_name, w.building_id, '') AS building_name, COUNT(*) AS cnt, " +
                        "AVG(CASE WHEN w.started_at IS NOT NULL AND COALESCE(w.closed_at, w.finished_at, w.updated_at) > w.started_at " +
                        "THEN EXTRACT(EPOCH FROM (COALESCE(w.closed_at, w.finished_at, w.updated_at) - w.started_at))/3600.0 ELSE 0 END) AS avg_hours " +
                        "FROM work_order w LEFT JOIN order_building_link obl ON w.id = obl.work_order_id " +
                        filter.whereSql()
        );
        if (query.buildingId() != null) {
            topBuildingsSql.append(" AND COALESCE(obl.building_id, w.building_id) = ? ");
            topBuildingParams.add(query.buildingId());
        }
        topBuildingsSql.append("GROUP BY COALESCE(obl.building_name, w.building_name, w.building_id, '') ORDER BY cnt DESC LIMIT 10");
        List<Map<String, Object>> topRows = jdbcTemplate.queryForList(topBuildingsSql.toString(), topBuildingParams.toArray());
        for (Map<String, Object> row : topRows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("buildingName", textValue(row.get("building_name")));
            item.put("count", numberValue(row.get("cnt"), 0).intValue());
            item.put("avgImpactHours", round(numberValue(row.get("avg_hours"), 0).doubleValue(), 2));
            topBuildings.add(item);
        }
        dashboard.set("affectedBuildingsTop10", topBuildings);

        List<Object> completedParams = new ArrayList<>(filter.params());
        completedParams.add("completed");
        completedParams.add("closed");
        Double averageHandleHours = jdbcTemplate.queryForObject(
                "SELECT COALESCE(AVG(CASE WHEN w.started_at IS NOT NULL AND COALESCE(w.finished_at, w.closed_at, w.updated_at) > w.started_at " +
                        "THEN EXTRACT(EPOCH FROM (COALESCE(w.finished_at, w.closed_at, w.updated_at) - w.started_at))/3600.0 ELSE 0 END), 0) " +
                        "FROM work_order w" + filter.whereSql() + " AND w.status IN (?, ?)",
                completedParams.toArray(),
                Double.class
        );

        Integer totalOrders = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM work_order w" + filter.whereSql(),
                filter.params().toArray(),
                Integer.class
        );

        Integer repeatedOrders = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(cnt),0) FROM (" +
                        "SELECT COUNT(*) AS cnt FROM work_order w" + filter.whereSql() +
                        " AND jsonb_array_length(w.segment_ids) > 0 GROUP BY w.segment_ids HAVING COUNT(*) > 1" +
                        ") t",
                filter.params().toArray(),
                Integer.class
        );

        Double totalCost = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(CASE WHEN w.maintenance_payload ? 'cost' THEN COALESCE((w.maintenance_payload->'cost'->>'totalCost')::numeric,0) ELSE 0 END), 0) " +
                        "FROM work_order w" + filter.whereSql(),
                filter.params().toArray(),
                Double.class
        );

        ObjectNode efficiency = objectMapper.createObjectNode();
        efficiency.put("averageHandleHours", round(averageHandleHours == null ? 0 : averageHandleHours, 2));
        int totalOrderCount = totalOrders == null ? 0 : totalOrders;
        int repeatedOrderCount = repeatedOrders == null ? 0 : repeatedOrders;
        efficiency.put("repeatedOrderRate", totalOrderCount == 0 ? 0 : round((double) repeatedOrderCount / totalOrderCount, 2));
        efficiency.put("totalCost", round(totalCost == null ? 0 : totalCost, 2));
        dashboard.set("efficiency", efficiency);

        ArrayNode trend = objectMapper.createArrayNode();
        List<Object> trendParams = new ArrayList<>(filter.params());
        trendParams.addAll(filter.params());
        List<Map<String, Object>> trendRows = jdbcTemplate.queryForList(
                "WITH all_days AS (" +
                        " SELECT day::date AS d FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') day" +
                        "), created_counts AS (" +
                        " SELECT w.created_at::date AS d, COUNT(*) AS c FROM work_order w" + filter.whereSql() + " GROUP BY w.created_at::date" +
                        "), completed_counts AS (" +
                        " SELECT COALESCE(w.finished_at, w.closed_at)::date AS d, COUNT(*) AS c FROM work_order w" + filter.whereSql() +
                        " AND COALESCE(w.finished_at, w.closed_at) IS NOT NULL GROUP BY COALESCE(w.finished_at, w.closed_at)::date" +
                        ") " +
                        "SELECT to_char(a.d, 'YYYY-MM-DD') AS day, COALESCE(cc.c,0) AS created, COALESCE(dc.c,0) AS completed " +
                        "FROM all_days a LEFT JOIN created_counts cc ON cc.d = a.d LEFT JOIN completed_counts dc ON dc.d = a.d ORDER BY a.d",
                trendParams.toArray()
        );
        for (Map<String, Object> row : trendRows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("date", textValue(row.get("day")));
            item.put("created", numberValue(row.get("created"), 0).intValue());
            item.put("completed", numberValue(row.get("completed"), 0).intValue());
            trend.add(item);
        }
        dashboard.set("trendByDay", trend);

        ArrayNode inProgressHeatmap = objectMapper.createArrayNode();
        List<Object> heatmapParams = new ArrayList<>(filter.params());
        heatmapParams.add("in_progress");
        heatmapParams.add("paused");
        heatmapParams.add("review");
        List<Map<String, Object>> heatRows = jdbcTemplate.queryForList(
                "SELECT w.id, w.title, w.building_id, COALESCE(w.building_name, b.building_name, '') AS building_name, " +
                        "COALESCE(ST_X(ST_Centroid(g.geom)), 119.1895) AS lon, COALESCE(ST_Y(ST_Centroid(g.geom)), 26.0254) AS lat " +
                        "FROM work_order w " +
                        "LEFT JOIN buildings b ON b.code = w.building_id " +
                        "LEFT JOIN LATERAL (" +
                        "  SELECT gf.geom " +
                        "  FROM geo_features gf " +
                        "  WHERE gf.layer = 'buildings' AND (" +
                        "    gf.id = w.building_id OR " +
                        "    LOWER(COALESCE(gf.properties->>'code', '')) = LOWER(COALESCE(w.building_id, '')) OR " +
                        "    LOWER(COALESCE(gf.properties->>'buildingCode', '')) = LOWER(COALESCE(w.building_id, '')) OR " +
                        "    LOWER(COALESCE(gf.properties->>'name', '')) = LOWER(COALESCE(w.building_name, b.building_name, '')) OR " +
                        "    LOWER(COALESCE(gf.properties->>'building_name', '')) = LOWER(COALESCE(w.building_name, b.building_name, ''))" +
                        "  ) " +
                        "  ORDER BY CASE " +
                        "    WHEN gf.id = w.building_id THEN 0 " +
                        "    WHEN LOWER(COALESCE(gf.properties->>'code', '')) = LOWER(COALESCE(w.building_id, '')) THEN 1 " +
                        "    WHEN LOWER(COALESCE(gf.properties->>'buildingCode', '')) = LOWER(COALESCE(w.building_id, '')) THEN 2 " +
                        "    WHEN LOWER(COALESCE(gf.properties->>'name', '')) = LOWER(COALESCE(w.building_name, b.building_name, '')) THEN 3 " +
                        "    ELSE 4 " +
                        "  END " +
                        "  LIMIT 1" +
                        ") g ON true " +
                        filter.whereSql() + " AND w.status IN (?, ?, ?) ORDER BY w.updated_at DESC LIMIT 500",
                heatmapParams.toArray()
        );
        int idx = 0;
        for (Map<String, Object> row : heatRows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("id", textValue(row.get("id")));
            item.put("title", textValue(row.get("title")));
            item.put("buildingId", textValue(row.get("building_id")));
            item.put("buildingName", textValue(row.get("building_name")));
            item.put("lng", numberValue(row.get("lon"), 119.1895).doubleValue());
            item.put("lat", numberValue(row.get("lat"), 26.0254).doubleValue());
            item.put("count", 1);
            item.put("clusterKey", "WO-" + (++idx));
            inProgressHeatmap.add(item);
        }
        dashboard.set("inProgressHeatmap", inProgressHeatmap);

        saveCache(cacheKey, dashboard);
        return dashboard;
    }

    private ObjectNode actionAddLog(ObjectNode payload) {
        String id = text(payload.get("id"));
        String content = text(payload.get("content"));
        String actor = defaultText(text(payload.get("actor")), "admin-ui");
        if (id == null || id.isBlank()) throw badRequest("id_required");
        if (content == null || content.isBlank()) throw badRequest("content_required");
        if (getWorkorder(id) == null) throw notFound("workorder_not_found");

        ObjectNode logPayload = payload.deepCopy();
        // payload.id is workorder id for /action add_log; avoid reusing it as work_order_log.id.
        logPayload.remove("id");
        insertExecutionLog(id, normalizeExecutionLog(logPayload, actor));
        touchWorkorder(id);
        invalidateCache();
        ObjectNode workorder = getWorkorder(id);
        if (workorder == null) throw notFound("workorder_not_found");
        return workorder;
    }

    private ObjectNode actionAdjustImpact(ObjectNode payload) {
        String id = text(payload.get("id"));
        String actor = text(payload.get("actor"));
        if (id == null || id.isBlank()) throw badRequest("id_required");
        if (actor == null || actor.isBlank()) throw badRequest("actor_required");

        ObjectNode current = getWorkorder(id);
        if (current == null) throw notFound("workorder_not_found");

        ArrayNode impactedBuildings = array(payload.get("impactedBuildings"));
        String bypassRequirement = defaultText(text(payload.get("bypassRequirement")), "");
        String note = defaultText(text(payload.get("note")), "手动调整影响范围");

        ObjectNode impactScope = objectMapper.createObjectNode();
        impactScope.set("impactedBuildings", impactedBuildings);
        impactScope.put("bypassRequirement", bypassRequirement);
        impactScope.put("manualAdjusted", true);

        ArrayNode adjustmentLogs = array(current.path("impactScope").path("adjustmentLogs")).deepCopy();
        ObjectNode adjustment = objectMapper.createObjectNode();
        adjustment.put("id", newLogId("IMPACT"));
        adjustment.put("adjustedAt", OffsetDateTime.now().toString());
        adjustment.put("adjustedBy", actor);
        adjustment.put("note", note);
        adjustmentLogs.add(adjustment);
        impactScope.set("adjustmentLogs", adjustmentLogs);

        jdbcTemplate.update(
                "UPDATE work_order SET impact_scope = ?::jsonb, updated_at = now() WHERE id = ?",
                impactScope.toString(),
                id
        );

        syncBuildingLinks(id, impactedBuildings, true);

        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", newLogId("LOG"));
        log.put("stage", "impact_adjust");
        log.put("content", note);
        log.put("actor", actor);
        log.put("createdAt", OffsetDateTime.now().toString());
        log.set("location", objectMapper.nullNode());
        log.set("photoUrls", objectMapper.createArrayNode());
        log.put("voiceUrl", "");
        log.put("nodeId", "");
        log.put("isMobileUpload", false);
        insertExecutionLog(id, log);

        invalidateCache();
        ObjectNode workorder = getWorkorder(id);
        if (workorder == null) throw notFound("workorder_not_found");
        return workorder;
    }

    private ObjectNode actionPumpControl(ObjectNode payload) {
        String id = text(payload.get("id"));
        String actor = defaultText(text(payload.get("actor")), "admin-ui");
        String action = defaultText(text(payload.get("action")), "close");
        if (id == null || id.isBlank()) throw badRequest("id_required");
        if (!Set.of("open", "close", "set_duration").contains(action)) {
            throw badRequest("invalid_pump_action");
        }

        ObjectNode current = getWorkorder(id);
        if (current == null) throw notFound("workorder_not_found");

        ArrayNode inputIds = array(payload.get("buildingIds"));
        List<String> buildingIds = new ArrayList<>();
        for (JsonNode node : inputIds) {
            String v = text(node);
            if (v != null && !v.isBlank()) buildingIds.add(v);
        }
        if (buildingIds.isEmpty()) {
            for (JsonNode building : array(current.path("impactScope").path("impactedBuildings"))) {
                String bid = text(building.get("buildingId"));
                if (bid != null && !bid.isBlank()) buildingIds.add(bid);
            }
        }
        if (buildingIds.isEmpty()) throw badRequest("building_ids_required");

        int duration = payload.has("durationMinutes") ? payload.path("durationMinutes").asInt(0) : 0;
        if ("set_duration".equals(action) && duration <= 0) {
            throw badRequest("duration_minutes_positive_required");
        }
        int total = buildingIds.size();

        for (int i = 0; i < buildingIds.size(); i++) {
            String buildingId = buildingIds.get(i);
            String buildingName = resolveBuildingName(current.path("impactScope").path("impactedBuildings"), buildingId);
            String beforeStatus = queryLatestPumpStatus(buildingId);
            String afterStatus = switch (action) {
                case "open" -> "running";
                case "close" -> "stopped";
                default -> "timed_run";
            };
            boolean success = Math.random() > 0.08;
            int countdown = "set_duration".equals(action) ? Math.max(0, duration * 60) : 0;

            ObjectNode row = objectMapper.createObjectNode();
            row.put("id", newLogId("PUMP"));
            row.put("buildingId", buildingId);
            row.put("buildingName", buildingName);
            row.put("pumpId", "HWP-" + buildingId);
            row.put("action", action);
            if ("set_duration".equals(action)) row.put("durationMinutes", duration);
            else row.set("durationMinutes", objectMapper.nullNode());
            row.put("result", success ? "success" : "failed");
            row.put("beforeStatus", beforeStatus);
            row.put("afterStatus", success ? afterStatus : beforeStatus);
            row.put("countdownSeconds", success ? countdown : 0);
            row.put("batchTotal", total);
            row.put("batchIndex", i + 1);
            row.put("progressPercent", round(((double) (i + 1) / total) * 100.0, 2));
            row.put("executedAt", OffsetDateTime.now().toString());
            row.put("executedBy", actor);
            row.put("message", success ? "执行成功" : "执行失败，请重试");
            insertPumpControlLog(id, row);
        }

        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", newLogId("LOG"));
        log.put("stage", "pump_control");
        log.put("content", "批量热水泵控制：" + total + " 栋楼，动作=" + action);
        log.put("actor", actor);
        log.put("createdAt", OffsetDateTime.now().toString());
        log.set("location", objectMapper.nullNode());
        log.set("photoUrls", objectMapper.createArrayNode());
        log.put("voiceUrl", "");
        log.put("nodeId", "");
        log.put("isMobileUpload", false);
        insertExecutionLog(id, log);

        touchWorkorder(id);
        invalidateCache();
        ObjectNode workorder = getWorkorder(id);
        if (workorder == null) throw notFound("workorder_not_found");
        return workorder;
    }

    private ObjectNode actionAddInspectionRecord(ObjectNode payload) {
        String id = text(payload.get("id"));
        String actor = defaultText(text(payload.get("actor")), "巡检员");
        String checkinNodeId = text(payload.get("checkinNodeId"));
        String judgement = text(payload.get("judgement"));

        if (id == null || id.isBlank()) throw badRequest("id_required");
        if (checkinNodeId == null || checkinNodeId.isBlank()) throw badRequest("checkinNodeId_required");
        if (judgement == null || (!"normal".equals(judgement) && !"abnormal".equals(judgement))) {
            throw badRequest("judgement_required");
        }

        ObjectNode current = getWorkorder(id);
        if (current == null) throw notFound("workorder_not_found");
        if (!"inspection".equals(current.path("type").asText())) {
            throw badRequest("only_inspection_supported");
        }

        if (!payload.has("pressure") || !payload.get("pressure").isNumber()) throw badRequest("pressure_required");
        if (!payload.has("waterQuality") || !payload.get("waterQuality").isNumber()) throw badRequest("waterQuality_required");

        ArrayNode photos = array(payload.get("photoUrls"));
        if (photos.isEmpty()) throw badRequest("photoUrls_required");

        JsonNode location = payload.get("location");
        if (location == null || !location.isObject() || !location.has("lng") || !location.has("lat") || !location.get("lng").isNumber() || !location.get("lat").isNumber()) {
            throw badRequest("location_required");
        }

        ObjectNode inspection = objectNode(current.get("inspection"));
        if (inspection == null) {
            inspection = objectMapper.createObjectNode();
            inspection.set("routeNodeIds", objectMapper.createArrayNode());
            inspection.set("scanCheckinNodeIds", objectMapper.createArrayNode());
            inspection.set("records", objectMapper.createArrayNode());
        }
        ArrayNode records = array(inspection.get("records"));

        ObjectNode record = objectMapper.createObjectNode();
        record.put("id", newLogId("INSP"));
        record.put("createdAt", OffsetDateTime.now().toString());
        record.put("checkinNodeId", checkinNodeId);
        record.set("photoUrls", photos.deepCopy());
        record.set("location", location.deepCopy());
        record.put("pressure", payload.path("pressure").asDouble());
        record.put("waterQuality", payload.path("waterQuality").asDouble());
        record.put("issueText", defaultText(text(payload.get("issueText")), ""));
        record.put("judgement", judgement);
        records.add(record);

        ArrayNode checkinNodeIds = array(inspection.get("scanCheckinNodeIds"));
        Set<String> checkins = new LinkedHashSet<>();
        for (JsonNode n : checkinNodeIds) {
            String v = text(n);
            if (v != null && !v.isBlank()) checkins.add(v);
        }
        checkins.add(checkinNodeId);
        ArrayNode mergedCheckins = objectMapper.createArrayNode();
        for (String item : checkins) mergedCheckins.add(item);

        inspection.set("records", records);
        inspection.set("scanCheckinNodeIds", mergedCheckins);

        jdbcTemplate.update(
                "UPDATE work_order SET inspection_payload = ?::jsonb, updated_at = now() WHERE id = ?",
                inspection.toString(),
                id
        );

        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", newLogId("LOG"));
        log.put("stage", "progress");
        log.put("content", "巡检记录上传：节点" + checkinNodeId + "，判定=" + judgement);
        log.put("actor", actor);
        log.put("createdAt", OffsetDateTime.now().toString());
        log.set("location", location.deepCopy());
        log.set("photoUrls", photos.deepCopy());
        log.put("voiceUrl", "");
        log.put("nodeId", checkinNodeId);
        log.put("isMobileUpload", true);
        insertExecutionLog(id, log);

        invalidateCache();
        ObjectNode workorder = getWorkorder(id);
        if (workorder == null) throw notFound("workorder_not_found");
        return workorder;
    }

    private ObjectNode actionConvertToMaintenance(ObjectNode payload) {
        String id = text(payload.get("id"));
        String actor = defaultText(text(payload.get("actor")), "巡检员");
        String reason = defaultText(text(payload.get("reason")), "巡检异常转维修工单");
        if (id == null || id.isBlank()) throw badRequest("id_required");

        ObjectNode sourceOrder = getWorkorder(id);
        if (sourceOrder == null) throw notFound("workorder_not_found");
        if (!"inspection".equals(sourceOrder.path("type").asText())) {
            throw badRequest("only_inspection_supported");
        }
        if (!hasAbnormalInspectionRecord(sourceOrder.path("inspection").path("records"))) {
            throw badRequest("inspection_abnormal_required");
        }

        ObjectNode createPayload = objectMapper.createObjectNode();
        createPayload.put("id", nextWorkorderId("maintenance"));
        createPayload.put("title", "[巡检转维修] " + sourceOrder.path("title").asText(""));
        createPayload.put("description", reason);
        createPayload.put("type", "maintenance");
        createPayload.put("source", "inspection_transfer");
        createPayload.put("pipelineMedium", sourceOrder.path("pipelineMedium").asText("mixed"));
        createPayload.put("area", sourceOrder.path("area").asText("未分区"));
        createPayload.set("topologyChain", sourceOrder.path("topologyChain").deepCopy());
        createPayload.set("nodeIds", sourceOrder.path("nodeIds").deepCopy());
        createPayload.set("segmentIds", sourceOrder.path("segmentIds").deepCopy());
        if (!isBlank(sourceOrder.path("buildingId").asText(""))) createPayload.put("buildingId", sourceOrder.path("buildingId").asText());
        if (!isBlank(sourceOrder.path("buildingName").asText(""))) createPayload.put("buildingName", sourceOrder.path("buildingName").asText());
        createPayload.set("roomIds", sourceOrder.path("roomIds").deepCopy());
        createPayload.set("equipmentIds", sourceOrder.path("equipmentIds").deepCopy());
        createPayload.set("impactScope", sourceOrder.path("impactScope").deepCopy());
        String sourcePriority = sourceOrder.path("priority").asText("medium");
        createPayload.put("priority", "low".equals(sourcePriority) ? "medium" : sourcePriority);
        ArrayNode links = objectMapper.createArrayNode();
        links.add(sourceOrder.path("id").asText());
        createPayload.set("linkedWorkorderIds", links);
        createPayload.put("createdBy", actor);

        ObjectNode maintenance = objectMapper.createObjectNode();
        maintenance.set("materials", objectMapper.createArrayNode());
        maintenance.set("steps", objectMapper.createArrayNode());
        maintenance.put("faultCause", "inspection_transfer");
        maintenance.put("healthBefore", "unknown");
        maintenance.put("healthAfter", "unknown");
        maintenance.set("acceptancePhotos", objectMapper.createArrayNode());
        maintenance.put("buildingRecoveryConfirmed", false);
        ObjectNode cost = objectMapper.createObjectNode();
        cost.put("laborCost", 0);
        cost.put("materialCost", 0);
        cost.put("durationHours", 0);
        cost.put("totalCost", 0);
        maintenance.set("cost", cost);
        maintenance.set("inspectionPrefill", sourceOrder.path("inspection").path("records").deepCopy());
        createPayload.set("maintenance", maintenance);

        ObjectNode created = upsertWorkorder(createPayload);

        ArrayNode sourceLinked = array(sourceOrder.get("linkedWorkorderIds"));
        Set<String> linked = new LinkedHashSet<>();
        for (JsonNode n : sourceLinked) {
            String v = text(n);
            if (v != null && !v.isBlank()) linked.add(v);
        }
        linked.add(created.path("id").asText());

        ArrayNode linkedJson = objectMapper.createArrayNode();
        for (String l : linked) linkedJson.add(l);

        jdbcTemplate.update(
                "UPDATE work_order SET linked_workorder_ids = ?::jsonb, updated_at = now() WHERE id = ?",
                linkedJson.toString(),
                id
        );

        ObjectNode sourceLog = objectMapper.createObjectNode();
        sourceLog.put("id", newLogId("LOG"));
        sourceLog.put("stage", "system_linkage");
        sourceLog.put("content", "巡检异常自动转维修工单：" + created.path("id").asText());
        sourceLog.put("actor", actor);
        sourceLog.put("createdAt", OffsetDateTime.now().toString());
        sourceLog.set("location", objectMapper.nullNode());
        sourceLog.set("photoUrls", objectMapper.createArrayNode());
        sourceLog.put("voiceUrl", "");
        sourceLog.put("nodeId", "");
        sourceLog.put("isMobileUpload", false);
        insertExecutionLog(id, sourceLog);

        invalidateCache();
        return created;
    }

    private void syncBuildingLinks(String workOrderId, JsonNode impactedBuildings, boolean manualAdjusted) {
        jdbcTemplate.update("DELETE FROM order_building_link WHERE work_order_id = ?", workOrderId);
        Set<String> insertedBuildingIds = new HashSet<>();
        for (JsonNode building : array(impactedBuildings)) {
            String buildingId = defaultText(text(building.get("buildingId")), "UNKNOWN");
            if (!insertedBuildingIds.add(buildingId)) {
                continue;
            }
            String buildingName = defaultText(text(building.get("buildingName")), buildingId);
            ArrayNode floors = array(building.get("floors"));
            ArrayNode rooms = array(building.get("rooms"));
            jdbcTemplate.update(
                    "INSERT INTO order_building_link (work_order_id, building_id, building_name, floor_nos, room_refs, source, is_manual_adjusted) VALUES (?, ?, ?, ?::jsonb, ?::jsonb, 'impact', ?)",
                    workOrderId,
                    buildingId,
                    buildingName,
                    floors.toString(),
                    rooms.toString(),
                    manualAdjusted
            );
        }
    }

    private void insertExecutionLog(String workOrderId, ObjectNode log) {
        jdbcTemplate.update(
                "INSERT INTO work_order_log (id, work_order_id, stage, content, actor, location, photo_urls, voice_url, node_id, is_mobile_upload, extra, created_at) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?::timestamptz)",
                defaultText(text(log.get("id")), newLogId("LOG")),
                workOrderId,
                defaultText(text(log.get("stage")), "progress"),
                defaultText(text(log.get("content")), ""),
                defaultText(text(log.get("actor")), "system"),
                jsonText(log.get("location")),
                jsonText(log.get("photoUrls")),
                defaultText(text(log.get("voiceUrl")), ""),
                defaultText(text(log.get("nodeId")), ""),
                log.path("isMobileUpload").asBoolean(false),
                "{}",
                defaultText(text(log.get("createdAt")), OffsetDateTime.now().toString())
        );
    }

    private void insertPumpControlLog(String workOrderId, ObjectNode row) {
        insertPumpControlLog(workOrderId, row, false);
    }

    private void insertPumpControlLog(String workOrderId, ObjectNode row, boolean fromMigration) {
        jdbcTemplate.update(
                "INSERT INTO pump_control_log (id, work_order_id, building_id, building_name, pump_id, action, duration_minutes, result, before_status, after_status, countdown_seconds, batch_total, batch_index, progress_percent, message, executed_by, executed_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?::jsonb)",
                defaultText(text(row.get("id")), newLogId("PUMP")),
                workOrderId,
                defaultText(text(row.get("buildingId")), "UNKNOWN"),
                defaultText(text(row.get("buildingName")), "未知楼宇"),
                defaultText(text(row.get("pumpId")), "HWP-UNKNOWN"),
                defaultText(text(row.get("action")), "close"),
                nullableInt(row.get("durationMinutes")),
                defaultText(text(row.get("result")), "failed"),
                defaultText(text(row.get("beforeStatus")), "unknown"),
                defaultText(text(row.get("afterStatus")), "unknown"),
                nullableInt(row.get("countdownSeconds")),
                nullableInt(row.get("batchTotal")),
                nullableInt(row.get("batchIndex")),
                nullableNumber(row.get("progressPercent")),
                defaultText(text(row.get("message")), ""),
                defaultText(text(row.get("executedBy")), "system"),
                defaultText(text(row.get("executedAt")), OffsetDateTime.now().toString()),
                fromMigration ? "{\"source\":\"migration\"}" : "{}"
        );
    }

    private ObjectNode normalizePumpControlLog(JsonNode raw, String actor, int total, boolean fromMigration) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", defaultText(text(raw.get("id")), newLogId("PUMP")));
        node.put("buildingId", defaultText(text(raw.get("buildingId")), "UNKNOWN"));
        node.put("buildingName", defaultText(text(raw.get("buildingName")), "未知楼宇"));
        node.put("pumpId", defaultText(text(raw.get("pumpId")), "HWP-" + node.path("buildingId").asText("UNKNOWN")));
        node.put("action", defaultText(text(raw.get("action")), "close"));
        if (raw.has("durationMinutes") && raw.get("durationMinutes").isNumber()) node.put("durationMinutes", raw.get("durationMinutes").asInt());
        else node.set("durationMinutes", objectMapper.nullNode());
        node.put("result", defaultText(text(raw.get("result")), "success"));
        node.put("beforeStatus", defaultText(text(raw.get("beforeStatus")), "unknown"));
        node.put("afterStatus", defaultText(text(raw.get("afterStatus")), "unknown"));
        node.put("countdownSeconds", raw.path("countdownSeconds").asInt(0));
        node.put("batchTotal", raw.path("batchTotal").asInt(total));
        node.put("batchIndex", raw.path("batchIndex").asInt(1));
        node.put("progressPercent", raw.path("progressPercent").asDouble(100));
        node.put("executedAt", defaultText(text(raw.get("executedAt")), OffsetDateTime.now().toString()));
        node.put("executedBy", defaultText(text(raw.get("executedBy")), actor));
        node.put("message", defaultText(text(raw.get("message")), fromMigration ? "迁移导入" : ""));
        return node;
    }

    private ObjectNode normalizeExecutionLog(JsonNode raw, String actor) {
        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", defaultText(text(raw.get("id")), newLogId("LOG")));
        log.put("stage", defaultText(text(raw.get("stage")), "progress"));
        log.put("content", defaultText(text(raw.get("content")), ""));
        log.put("actor", defaultText(text(raw.get("actor")), actor));
        log.put("createdAt", defaultText(text(raw.get("createdAt")), OffsetDateTime.now().toString()));
        if (raw.has("location") && raw.get("location").isObject()) log.set("location", raw.get("location").deepCopy());
        else log.set("location", objectMapper.nullNode());
        log.set("photoUrls", array(raw.get("photoUrls")).deepCopy());
        log.put("voiceUrl", defaultText(text(raw.get("voiceUrl")), ""));
        log.put("nodeId", defaultText(text(raw.get("nodeId")), ""));
        log.put("isMobileUpload", raw.path("isMobileUpload").asBoolean(false));
        return log;
    }

    private ObjectNode createDefaultCreatedLog(ObjectNode workorder) {
        ObjectNode log = objectMapper.createObjectNode();
        log.put("id", newLogId("LOG"));
        log.put("stage", "created");
        String source = workorder.path("source").asText("manual");
        if ("manual".equals(source)) {
            log.put("content", "工单创建（人工）");
        } else {
            String triggerReason = workorder.path("autoTriggerReason").asText("");
            if (isBlank(triggerReason)) log.put("content", "工单创建（自动触发）");
            else log.put("content", "工单自动触发：" + triggerReason);
        }
        log.put("actor", workorder.path("createdBy").asText("admin-ui"));
        log.put("createdAt", workorder.path("createdAt").asText(OffsetDateTime.now().toString()));
        log.set("location", objectMapper.nullNode());
        log.set("photoUrls", objectMapper.createArrayNode());
        log.put("voiceUrl", "");
        log.put("nodeId", "");
        log.put("isMobileUpload", false);
        return log;
    }

    private void touchWorkorder(String id) {
        jdbcTemplate.update("UPDATE work_order SET updated_at = now() WHERE id = ?", id);
    }

    private String queryLatestPumpStatus(String buildingId) {
        try {
            String status = jdbcTemplate.queryForObject(
                    "SELECT after_status FROM pump_control_log WHERE building_id = ? ORDER BY executed_at DESC LIMIT 1",
                    String.class,
                    buildingId
            );
            if (status != null && !status.isBlank()) return status;
        } catch (EmptyResultDataAccessException ignored) {
            // ignored
        }
        return "unknown";
    }

    private String resolveBuildingName(JsonNode impactedBuildings, String buildingId) {
        for (JsonNode node : array(impactedBuildings)) {
            if (buildingId.equals(text(node.get("buildingId")))) {
                String name = text(node.get("buildingName"));
                return name == null ? buildingId : name;
            }
        }
        return buildingId;
    }

    private ObjectNode normalizeWorkOrderInput(JsonNode body, ObjectNode existing, String id, boolean isNew) {
        String now = OffsetDateTime.now().toString();

        ObjectNode normalized = objectMapper.createObjectNode();
        normalized.put("id", id);
        normalized.put("title", defaultText(text(body.get("title")), existing == null ? "未命名工单" : existing.path("title").asText("未命名工单")));
        normalized.put("description", defaultText(text(body.get("description")), existing == null ? "" : existing.path("description").asText("")));

        String type = defaultText(text(body.get("type")), existing == null ? "inspection" : existing.path("type").asText("inspection"));
        if (!ORDER_TYPES.contains(type)) throw badRequest("invalid_type");
        normalized.put("type", type);

        String source = defaultText(text(body.get("source")), existing == null ? "manual" : existing.path("source").asText("manual"));
        if (!ORDER_SOURCE.contains(source)) source = "manual";
        normalized.put("source", source);

        String status = defaultText(text(body.get("status")), existing == null ? ("manual".equals(source) ? "draft" : "todo") : existing.path("status").asText("draft"));
        if (!ORDER_STATUS.contains(status)) status = "draft";
        normalized.put("status", status);

        String medium = defaultText(text(body.get("pipelineMedium")), existing == null ? "mixed" : existing.path("pipelineMedium").asText("mixed"));
        if (!ORDER_MEDIUM.contains(medium)) medium = "mixed";
        normalized.put("pipelineMedium", medium);

        String priority = defaultText(text(body.get("priority")), existing == null ? "medium" : existing.path("priority").asText("medium"));
        JsonNode autoTrigger = body.get("autoTrigger");
        if (isNew && autoTrigger != null && autoTrigger.isObject() && autoTrigger.has("severity")) {
            priority = defaultText(text(autoTrigger.get("severity")), priority);
        }
        if (!ORDER_PRIORITY.contains(priority)) priority = "medium";
        normalized.put("priority", priority);

        normalized.put("area", defaultText(text(body.get("area")), existing == null ? "未分区" : existing.path("area").asText("未分区")));

        normalized.set("topologyChain", arrayOrDefault(body.get("topologyChain"), existing == null ? null : existing.get("topologyChain")));
        normalized.set("nodeIds", arrayOrDefault(body.get("nodeIds"), existing == null ? null : existing.get("nodeIds")));
        normalized.set("segmentIds", arrayOrDefault(body.get("segmentIds"), existing == null ? null : existing.get("segmentIds")));

        normalized.put("buildingId", defaultText(text(body.get("buildingId")), existing == null ? "" : existing.path("buildingId").asText("")));
        normalized.put("buildingName", defaultText(text(body.get("buildingName")), existing == null ? "" : existing.path("buildingName").asText("")));

        normalized.set("roomIds", arrayOrDefault(body.get("roomIds"), existing == null ? null : existing.get("roomIds")));
        normalized.set("equipmentIds", arrayOrDefault(body.get("equipmentIds"), existing == null ? null : existing.get("equipmentIds")));

        normalized.put("assignee", defaultText(text(body.get("assignee")), existing == null ? "" : existing.path("assignee").asText("")));
        normalized.put("reviewer", defaultText(text(body.get("reviewer")), existing == null ? "" : existing.path("reviewer").asText("")));

        normalized.put("plannedDate", defaultText(text(body.get("plannedDate")), existing == null ? "" : existing.path("plannedDate").asText("")));
        normalized.put("deadlineAt", defaultText(text(body.get("deadlineAt")), existing == null ? "" : existing.path("deadlineAt").asText("")));
        normalized.put("startedAt", defaultText(text(body.get("startedAt")), existing == null ? "" : existing.path("startedAt").asText("")));
        normalized.put("reviewedAt", defaultText(text(body.get("reviewedAt")), existing == null ? "" : existing.path("reviewedAt").asText("")));
        normalized.put("finishedAt", defaultText(text(body.get("finishedAt")), existing == null ? "" : existing.path("finishedAt").asText("")));
        normalized.put("closedAt", defaultText(text(body.get("closedAt")), existing == null ? "" : existing.path("closedAt").asText("")));
        normalized.put("pausedAt", defaultText(text(body.get("pausedAt")), existing == null ? "" : existing.path("pausedAt").asText("")));
        normalized.put("rejectedAt", defaultText(text(body.get("rejectedAt")), existing == null ? "" : existing.path("rejectedAt").asText("")));

        normalized.put("resultSummary", defaultText(text(body.get("resultSummary")), existing == null ? "" : existing.path("resultSummary").asText("")));
        normalized.set("linkedWorkorderIds", arrayOrDefault(body.get("linkedWorkorderIds"), existing == null ? null : existing.get("linkedWorkorderIds")));

        JsonNode impactNode = body.get("impactScope");
        ObjectNode impact;
        if (impactNode != null && impactNode.isObject()) {
            impact = (ObjectNode) impactNode.deepCopy();
        } else {
            boolean changedTopology = isNew || body.has("buildingId") || body.has("buildingName") || body.has("nodeIds") || body.has("segmentIds") || body.has("pipelineMedium");
            if (!changedTopology && existing != null && existing.has("impactScope")) {
                impact = objectNode(existing.get("impactScope"));
                if (impact == null) impact = objectMapper.createObjectNode();
            } else {
                impact = inferImpactScope(
                        normalized.path("buildingId").asText(""),
                        normalized.path("buildingName").asText(""),
                        toTextList(normalized.get("nodeIds")),
                        toTextList(normalized.get("segmentIds")),
                        normalized.path("pipelineMedium").asText("mixed")
                );
            }
        }

        if (!impact.has("impactedBuildings") || !impact.get("impactedBuildings").isArray()) {
            impact.set("impactedBuildings", objectMapper.createArrayNode());
        }
        if (!impact.has("bypassRequirement") || impact.get("bypassRequirement").isNull()) {
            impact.put("bypassRequirement", "");
        }
        if (!impact.has("manualAdjusted")) {
            impact.put("manualAdjusted", false);
        }
        if (!impact.has("adjustmentLogs") || !impact.get("adjustmentLogs").isArray()) {
            impact.set("adjustmentLogs", objectMapper.createArrayNode());
        }
        normalized.set("impactScope", impact);

        normalized.set("inspection", objectOrNull(body.get("inspection"), existing == null ? null : existing.get("inspection")));
        normalized.set("maintenance", objectOrNull(body.get("maintenance"), existing == null ? null : existing.get("maintenance")));
        normalized.set("retrofit", objectOrNull(body.get("retrofit"), existing == null ? null : existing.get("retrofit")));
        normalized.set("retire", objectOrNull(body.get("retire"), existing == null ? null : existing.get("retire")));
        normalized.set("notifications", arrayOrDefault(body.get("notifications"), existing == null ? null : existing.get("notifications")));

        String createdBy = defaultText(text(body.get("createdBy")), existing == null ? "admin-ui" : existing.path("createdBy").asText("admin-ui"));
        normalized.put("createdBy", createdBy);
        String createdAt = defaultText(text(body.get("createdAt")), existing == null ? now : existing.path("createdAt").asText(now));
        normalized.put("createdAt", createdAt);
        normalized.put("updatedAt", defaultText(text(body.get("updatedAt")), now));

        if (autoTrigger != null && autoTrigger.isObject() && autoTrigger.has("reason")) {
            normalized.put("autoTriggerReason", defaultText(text(autoTrigger.get("reason")), ""));
        }

        return normalized;
    }

    private ObjectNode inferImpactScope(String buildingId, String buildingName, List<String> nodeIds, List<String> segmentIds, String medium) {
        LinkedHashMap<String, BuildingSeed> candidates = new LinkedHashMap<>();

        if (!isBlank(buildingId) || !isBlank(buildingName)) {
            String id = isBlank(buildingId) ? buildingName : buildingId;
            String name = isBlank(buildingName) ? id : buildingName;
            candidates.put(id, new BuildingSeed(id, name));
        }

        for (String nodeId : nodeIds) {
            List<BuildingSeed> seeds = TOPOLOGY_IMPACT_INDEX.getOrDefault(nodeId, List.of());
            for (BuildingSeed seed : seeds) candidates.put(seed.id(), seed);
        }
        for (String segmentId : segmentIds) {
            List<BuildingSeed> seeds = TOPOLOGY_IMPACT_INDEX.getOrDefault(segmentId, List.of());
            for (BuildingSeed seed : seeds) candidates.put(seed.id(), seed);
        }

        ArrayNode impactedBuildings = objectMapper.createArrayNode();

        for (BuildingSeed candidate : candidates.values()) {
            List<Map<String, Object>> rooms = jdbcTemplate.queryForList(
                    "SELECT id, room_no, floor FROM rooms WHERE building_code = ? ORDER BY floor, room_no LIMIT 5",
                    candidate.id()
            );
            if (rooms.isEmpty()) {
                rooms = jdbcTemplate.queryForList(
                        "SELECT id, room_no, floor FROM rooms WHERE building_name = ? ORDER BY floor, room_no LIMIT 5",
                        candidate.name()
                );
            }

            ArrayNode roomArr = objectMapper.createArrayNode();
            Set<Integer> floors = new HashSet<>();

            for (Map<String, Object> room : rooms) {
                ObjectNode r = objectMapper.createObjectNode();
                r.put("buildingId", candidate.id());
                r.put("buildingName", candidate.name());
                if (room.get("floor") instanceof Number n) {
                    floors.add(n.intValue());
                    r.put("floorNo", n.intValue());
                } else {
                    r.set("floorNo", objectMapper.nullNode());
                }
                String roomNo = textValue(room.get("room_no"));
                r.put("roomNo", roomNo);
                r.put("roomId", textValue(room.get("id")));
                ArrayNode equipmentIds = objectMapper.createArrayNode();
                equipmentIds.add("PUMP-" + (isBlank(roomNo) ? "00" : roomNo));
                r.set("equipmentIds", equipmentIds);
                roomArr.add(r);
            }

            ObjectNode b = objectMapper.createObjectNode();
            b.put("buildingId", candidate.id());
            b.put("buildingName", candidate.name());
            ArrayNode floorArr = objectMapper.createArrayNode();
            floors.stream().sorted().forEach(floorArr::add);
            b.set("floors", floorArr);
            b.set("rooms", roomArr);
            impactedBuildings.add(b);
        }

        ObjectNode scope = objectMapper.createObjectNode();
        scope.set("impactedBuildings", impactedBuildings);
        scope.put("bypassRequirement", buildBypassRequirement(medium, impactedBuildings));
        scope.put("manualAdjusted", false);
        scope.set("adjustmentLogs", objectMapper.createArrayNode());
        return scope;
    }

    private String buildBypassRequirement(String medium, ArrayNode impactedBuildings) {
        if (impactedBuildings.isEmpty()) return "暂无避让要求";
        List<String> names = new ArrayList<>();
        for (JsonNode item : impactedBuildings) {
            String name = text(item.get("buildingName"));
            if (name != null && !name.isBlank()) names.add(name);
        }
        String joined = String.join("、", names);
        return switch (medium) {
            case "water" -> "维修/改造期间，" + joined + " 需临时断水并做好用水保障。";
            case "sewage" -> "维修/改造期间，" + joined + " 需临时限制污水排放并避让地下作业面。";
            case "drainage" -> "施工期间，" + joined + " 排水路径需临时切换，避免施工区积水。";
            default -> "施工期间，" + joined + " 需按管网链路要求执行临时避让。";
        };
    }

    private boolean isValidTransition(String current, String action) {
        Map<String, Set<String>> map = Map.of(
                "draft", Set.of("submit", "cancel", "reject"),
                "todo", Set.of("assign", "start", "cancel", "reject"),
                "assigned", Set.of("start", "cancel", "reject"),
                "in_progress", Set.of("to_review", "pause", "cancel", "reject"),
                "paused", Set.of("resume", "cancel", "reject"),
                "review", Set.of("approve", "reopen", "cancel", "reject"),
                "completed", Set.of("close", "reopen"),
                "closed", Set.of("reopen"),
                "cancelled", Set.of("reopen"),
                "rejected", Set.of("reopen")
        );
        return map.getOrDefault(current, Set.of()).contains(action);
    }

    private boolean hasAbnormalInspectionRecord(JsonNode recordsNode) {
        if (recordsNode == null || !recordsNode.isArray()) return false;
        for (JsonNode record : recordsNode) {
            if ("abnormal".equalsIgnoreCase(defaultText(text(record.get("judgement")), ""))) {
                return true;
            }
        }
        return false;
    }

    private boolean shouldReopenToTodo(String current) {
        return Set.of("draft", "todo", "assigned", "cancelled", "rejected").contains(current);
    }

    private ObjectNode mapWorkOrder(Map<String, Object> row) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", textValue(row.get("id")));
        node.put("title", textValue(row.get("title")));
        node.put("description", textValue(row.get("description")));
        node.put("type", textValue(row.get("order_type")));
        node.put("source", textValue(row.get("source")));
        node.put("status", textValue(row.get("status")));
        node.put("pipelineMedium", textValue(row.get("pipeline_medium")));
        node.put("priority", textValue(row.get("priority")));
        node.put("area", textValue(row.get("area")));

        node.set("topologyChain", parseJsonArray(row.get("topology_chain")));
        node.set("nodeIds", parseJsonArray(row.get("node_ids")));
        node.set("segmentIds", parseJsonArray(row.get("segment_ids")));

        node.put("buildingId", nullableTextValue(row.get("building_id")));
        node.put("buildingName", nullableTextValue(row.get("building_name")));
        node.set("roomIds", parseJsonArray(row.get("room_ids")));
        node.set("equipmentIds", parseJsonArray(row.get("equipment_ids")));

        node.put("assignee", nullableTextValue(row.get("assignee")));
        node.put("reviewer", nullableTextValue(row.get("reviewer")));
        node.put("plannedDate", textFromDate(row.get("planned_date")));
        node.put("deadlineAt", textFromTimestamp(row.get("deadline_at")));
        node.put("startedAt", textFromTimestamp(row.get("started_at")));
        node.put("reviewedAt", textFromTimestamp(row.get("reviewed_at")));
        node.put("finishedAt", textFromTimestamp(row.get("finished_at")));
        node.put("closedAt", textFromTimestamp(row.get("closed_at")));
        node.put("pausedAt", textFromTimestamp(row.get("paused_at")));
        node.put("rejectedAt", textFromTimestamp(row.get("rejected_at")));

        node.put("resultSummary", textValue(row.get("result_summary")));
        node.set("linkedWorkorderIds", parseJsonArray(row.get("linked_workorder_ids")));

        node.set("impactScope", parseJsonObject(row.get("impact_scope"), defaultImpactScope()));
        node.set("inspection", parseJsonObjectOrNull(row.get("inspection_payload")));
        node.set("maintenance", parseJsonObjectOrNull(row.get("maintenance_payload")));
        node.set("retrofit", parseJsonObjectOrNull(row.get("retrofit_payload")));
        node.set("retire", parseJsonObjectOrNull(row.get("retire_payload")));
        node.set("notifications", parseJsonArray(row.get("notifications")));

        node.set("pumpControls", parseJsonArray(row.get("pump_controls")));
        node.set("executionLogs", parseJsonArray(row.get("execution_logs")));

        node.put("createdBy", textValue(row.get("created_by")));
        node.put("createdAt", textFromTimestamp(row.get("created_at")));
        node.put("updatedAt", textFromTimestamp(row.get("updated_at")));
        return node;
    }

    private ObjectNode defaultImpactScope() {
        ObjectNode node = objectMapper.createObjectNode();
        node.set("impactedBuildings", objectMapper.createArrayNode());
        node.put("bypassRequirement", "");
        node.put("manualAdjusted", false);
        node.set("adjustmentLogs", objectMapper.createArrayNode());
        return node;
    }

    private String nextWorkorderId(String type) {
        String prefix = switch (type == null ? "" : type) {
            case "inspection" -> "INS";
            case "maintenance" -> "MAI";
            case "retrofit" -> "RET";
            case "retire" -> "SCR";
            default -> "OPS";
        };
        return "WO-" + prefix + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String newLogId(String prefix) {
        return prefix + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
    }

    private void invalidateCache() {
        cache.clear();
    }

    private JsonNode readCache(String key) {
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;
        if (System.currentTimeMillis() > entry.expireAt()) {
            cache.remove(key);
            return null;
        }
        return entry.data().deepCopy();
    }

    private void saveCache(String key, JsonNode value) {
        if (!cache.containsKey(key)) {
            trimCacheIfNeeded();
        }
        cache.put(key, new CacheEntry(System.currentTimeMillis() + CACHE_TTL_MS, value.deepCopy()));
    }

    private void trimCacheIfNeeded() {
        if (cache.size() < MAX_CACHE_ENTRIES) return;
        long now = System.currentTimeMillis();

        int expiredRemoved = 0;
        for (Map.Entry<String, CacheEntry> entry : cache.entrySet()) {
            CacheEntry value = entry.getValue();
            if (value.expireAt() <= now && cache.remove(entry.getKey(), value)) {
                expiredRemoved++;
                if (expiredRemoved >= CACHE_CLEANUP_BATCH) break;
            }
        }

        int overflow = cache.size() - MAX_CACHE_ENTRIES + 1;
        if (overflow <= 0) return;

        List<Map.Entry<String, CacheEntry>> snapshot = new ArrayList<>(cache.entrySet());
        snapshot.sort(Comparator.comparingLong(e -> e.getValue().expireAt()));
        int toEvict = Math.min(snapshot.size(), overflow + CACHE_CLEANUP_BATCH);
        for (int i = 0; i < toEvict; i++) {
            Map.Entry<String, CacheEntry> entry = snapshot.get(i);
            cache.remove(entry.getKey(), entry.getValue());
        }
    }

    private RuntimeException badRequest(String message) {
        return new PipelineOpsException(400, message);
    }

    private RuntimeException notFound(String message) {
        return new PipelineOpsException(404, message);
    }

    private ArrayNode parseJsonArray(Object raw) {
        if (raw == null) return objectMapper.createArrayNode();
        if (raw instanceof JsonNode node && node.isArray()) return (ArrayNode) node.deepCopy();
        try {
            JsonNode parsed = objectMapper.readTree(String.valueOf(raw));
            if (parsed.isArray()) return (ArrayNode) parsed;
            return objectMapper.createArrayNode();
        } catch (Exception e) {
            return objectMapper.createArrayNode();
        }
    }

    private ObjectNode parseJsonObject(Object raw, ObjectNode fallback) {
        if (raw == null) return fallback.deepCopy();
        if (raw instanceof JsonNode node && node.isObject()) return (ObjectNode) node.deepCopy();
        try {
            JsonNode parsed = objectMapper.readTree(String.valueOf(raw));
            if (parsed.isObject()) return (ObjectNode) parsed;
            return fallback.deepCopy();
        } catch (Exception e) {
            return fallback.deepCopy();
        }
    }

    private ObjectNode parseJsonObjectOrNull(Object raw) {
        if (raw == null) return null;
        if (raw instanceof JsonNode node && node.isObject()) return (ObjectNode) node.deepCopy();
        try {
            JsonNode parsed = objectMapper.readTree(String.valueOf(raw));
            if (parsed.isObject()) return (ObjectNode) parsed;
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private String jsonText(JsonNode node) {
        if (node == null || node.isNull()) return "null";
        return node.toString();
    }

    private ArrayNode array(JsonNode node) {
        if (node != null && node.isArray()) return (ArrayNode) node;
        return objectMapper.createArrayNode();
    }

    private ArrayNode arrayOrDefault(JsonNode primary, JsonNode fallback) {
        if (primary != null && primary.isArray()) return (ArrayNode) primary.deepCopy();
        if (fallback != null && fallback.isArray()) return (ArrayNode) fallback.deepCopy();
        return objectMapper.createArrayNode();
    }

    private ObjectNode objectNode(JsonNode node) {
        if (node != null && node.isObject()) return (ObjectNode) node;
        return null;
    }

    private JsonNode objectOrNull(JsonNode primary, JsonNode fallback) {
        if (primary != null && primary.isObject()) return primary.deepCopy();
        if (fallback != null && fallback.isObject()) return fallback.deepCopy();
        return objectMapper.nullNode();
    }

    private List<String> toTextList(JsonNode arrayNode) {
        List<String> list = new ArrayList<>();
        if (arrayNode == null || !arrayNode.isArray()) return list;
        for (JsonNode node : arrayNode) {
            String value = text(node);
            if (value != null && !value.isBlank()) list.add(value);
        }
        return list;
    }

    private String text(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) {
            String value = node.asText();
            return value == null ? null : value.trim();
        }
        if (node.isNumber() || node.isBoolean()) return String.valueOf(node.asText()).trim();
        return null;
    }

    private String textValue(Object value) {
        if (value == null) return "";
        return String.valueOf(value);
    }

    private String nullableTextValue(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        return text == null ? "" : text;
    }

    private String textFromDate(Object value) {
        if (value == null) return "";
        if (value instanceof Date d) return d.toLocalDate().toString();
        return String.valueOf(value);
    }

    private String textFromTimestamp(Object value) {
        if (value == null) return "";
        if (value instanceof OffsetDateTime odt) return odt.toString();
        if (value instanceof Timestamp ts) return ts.toInstant().toString();
        return String.valueOf(value);
    }

    private String textValue(JsonNode node) {
        return node == null || node.isNull() ? "" : node.asText("");
    }

    private String defaultText(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value.trim();
    }

    private boolean isDateOnly(String value) {
        if (value == null || value.isBlank()) return false;
        String trimmed = value.trim();
        try {
            return trimmed.length() == 10 && LocalDate.parse(trimmed).toString().equals(trimmed);
        } catch (DateTimeParseException ex) {
            return false;
        }
    }

    private String normalizeCreatedAtFilter(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        if (isDateOnly(trimmed)) return trimmed;
        try {
            OffsetDateTime.parse(trimmed);
            return trimmed;
        } catch (DateTimeParseException ignored) {
        }
        try {
            LocalDateTime.parse(trimmed);
            return trimmed;
        } catch (DateTimeParseException ignored) {
        }
        try {
            Timestamp.valueOf(trimmed);
            return trimmed;
        } catch (IllegalArgumentException ignored) {
        }
        throw badRequest(fieldName + "_invalid_datetime");
    }

    private String buildSummaryCacheKey(String prefix, PipelineOrderListQuery query) {
        return prefix + ":" + query.type() + "|" + query.status() + "|" + query.area() + "|" + query.pipelineMedium()
                + "|" + query.nodeId() + "|" + query.segmentId() + "|" + query.buildingId() + "|" + query.assignee()
                + "|" + query.createdFrom() + "|" + query.createdTo() + "|" + query.keyword();
    }

    private QueryFilter buildQueryFilter(PipelineOrderListQuery query, String alias) {
        String createdFrom = normalizeCreatedAtFilter(query.createdFrom(), "createdFrom");
        String createdTo = normalizeCreatedAtFilter(query.createdTo(), "createdTo");
        String aliasPrefix = (alias == null || alias.isBlank()) ? "" : alias + ".";

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (query.type() != null) {
            where.append(" AND ").append(aliasPrefix).append("order_type = ? ");
            params.add(query.type());
        }
        if (query.status() != null) {
            where.append(" AND ").append(aliasPrefix).append("status = ? ");
            params.add(query.status());
        }
        if (query.area() != null) {
            where.append(" AND ").append(aliasPrefix).append("area = ? ");
            params.add(query.area());
        }
        if (query.pipelineMedium() != null) {
            where.append(" AND ").append(aliasPrefix).append("pipeline_medium = ? ");
            params.add(query.pipelineMedium());
        }
        if (query.assignee() != null) {
            where.append(" AND ").append(aliasPrefix).append("assignee = ? ");
            params.add(query.assignee());
        }
        if (query.nodeId() != null) {
            where.append(" AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(")
                    .append(aliasPrefix).append("node_ids) t(v) WHERE t.v = ?) ");
            params.add(query.nodeId());
        }
        if (query.segmentId() != null) {
            where.append(" AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(")
                    .append(aliasPrefix).append("segment_ids) t(v) WHERE t.v = ?) ");
            params.add(query.segmentId());
        }
        if (query.buildingId() != null) {
            where.append(" AND (").append(aliasPrefix).append("building_id = ? OR EXISTS (")
                    .append("SELECT 1 FROM order_building_link obl_filter WHERE obl_filter.work_order_id = ")
                    .append(aliasPrefix).append("id AND obl_filter.building_id = ?)) ");
            params.add(query.buildingId());
            params.add(query.buildingId());
        }
        if (createdFrom != null) {
            where.append(" AND ").append(aliasPrefix).append("created_at >= ?::timestamptz ");
            params.add(createdFrom);
        }
        if (createdTo != null) {
            if (isDateOnly(createdTo)) {
                where.append(" AND ").append(aliasPrefix).append("created_at < (?::date + INTERVAL '1 day') ");
            } else {
                where.append(" AND ").append(aliasPrefix).append("created_at <= ?::timestamptz ");
            }
            params.add(createdTo);
        }
        if (query.keyword() != null) {
            where.append(" AND (LOWER(").append(aliasPrefix).append("id) LIKE ? OR LOWER(").append(aliasPrefix).append("title) LIKE ? ")
                    .append("OR LOWER(").append(aliasPrefix).append("description) LIKE ? OR LOWER(COALESCE(").append(aliasPrefix).append("assignee, '')) LIKE ? ")
                    .append("OR LOWER(COALESCE(").append(aliasPrefix).append("building_id, '')) LIKE ? OR LOWER(COALESCE(").append(aliasPrefix).append("building_name, '')) LIKE ? ")
                    .append("OR LOWER(").append(aliasPrefix).append("node_ids::text) LIKE ? OR LOWER(").append(aliasPrefix).append("segment_ids::text) LIKE ?) ");
            String kw = "%" + query.keyword().toLowerCase(Locale.ROOT) + "%";
            for (int i = 0; i < 8; i++) {
                params.add(kw);
            }
        }

        return new QueryFilter(where.toString(), params);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String withComment(String comment) {
        if (comment == null || comment.isBlank()) return "";
        return "；" + comment.trim();
    }

    private String nullableText(JsonNode node) {
        String value = text(node);
        if (value == null || value.isBlank()) return null;
        return value;
    }

    private String normalizeDateText(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            return LocalDate.parse(trimmed).toString();
        } catch (DateTimeParseException ex) {
            throw badRequest(fieldName + "_invalid_date");
        }
    }

    private String normalizeTimestampText(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            return OffsetDateTime.parse(trimmed).toString();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(trimmed).toString();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return Timestamp.valueOf(trimmed).toLocalDateTime().toString();
        } catch (IllegalArgumentException ignored) {
        }
        throw badRequest(fieldName + "_invalid_datetime");
    }

    private String nullableDate(JsonNode node, String fieldName) {
        return normalizeDateText(text(node), fieldName);
    }

    private String nullableTimestamp(JsonNode node, String fieldName) {
        return normalizeTimestampText(text(node), fieldName);
    }

    private Integer nullableInt(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isInt() || node.isLong()) return node.asInt();
        if (node.isTextual()) {
            try {
                return Integer.parseInt(node.asText().trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private Number nullableNumber(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isNumber()) return node.numberValue();
        if (node.isTextual()) {
            try {
                return Double.parseDouble(node.asText().trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private Number numberValue(Object raw, Number defaultValue) {
        if (raw == null) return defaultValue;
        if (raw instanceof Number n) return n;
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private int clamp(Integer value, int min, int max, int defaultValue) {
        if (value == null) return defaultValue;
        return Math.max(min, Math.min(max, value));
    }

    private double round(double value, int precision) {
        double scale = Math.pow(10, precision);
        return Math.round(value * scale) / scale;
    }

    public record PipelineOrderListQuery(
            String type,
            String status,
            String area,
            String pipelineMedium,
            String nodeId,
            String segmentId,
            String buildingId,
            String assignee,
            String createdFrom,
            String createdTo,
            String keyword,
            int page,
            Integer limit
    ) {
        public String cacheKey() {
            return type + "|" + status + "|" + area + "|" + pipelineMedium + "|" + nodeId + "|" + segmentId + "|" + buildingId + "|" + assignee + "|" + createdFrom + "|" + createdTo + "|" + keyword + "|" + page + "|" + limit;
        }
    }

    private record QueryFilter(String whereSql, List<Object> params) {
    }

    private record BuildingSeed(String id, String name) {
    }

    private record CacheEntry(long expireAt, JsonNode data) {
    }

    public static class PipelineOpsException extends RuntimeException {
        private final int statusCode;

        public PipelineOpsException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}
