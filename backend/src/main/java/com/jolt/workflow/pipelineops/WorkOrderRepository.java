package com.jolt.workflow.pipelineops;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class WorkOrderRepository extends WorkOrderRepositorySupport {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderRepository.class);

    private record PipeMatch(
            String featureId,
            String featureName,
            String segmentId,
            String area,
            String pipelineMedium
    ) {
    }

    public WorkOrderRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        super(jdbcTemplate, objectMapper);
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
    public ObjectNode quickReport(JsonNode body) {
        if (!body.has("lng") || !body.get("lng").isNumber() || !body.has("lat") || !body.get("lat").isNumber()) {
            throw badRequest("location_required");
        }

        String featureId = text(body.get("featureId"));
        String faultType = defaultText(text(body.get("faultType")), "other");
        if (!Set.of("leak", "burst", "blockage", "other").contains(faultType)) {
            throw badRequest("fault_type_invalid");
        }

        String severity = defaultText(text(body.get("severity")), "medium");
        if (!ORDER_PRIORITY.contains(severity)) {
            severity = "medium";
        }

        double lng = body.get("lng").asDouble();
        double lat = body.get("lat").asDouble();
        String note = defaultText(text(body.get("note")), "");
        String reportedBy = defaultText(text(body.get("reportedBy")), "admin-2d-editor");

        PipeMatch match = selectQuickReportPipeMatch(featureId, lng, lat);
        if (match == null) {
            throw notFound("nearest_pipe_not_found");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("id", nextWorkorderId("maintenance"));
        payload.put("title", buildQuickReportTitle(match.featureName(), faultType, severity));
        payload.put("description", note);
        payload.put("type", "maintenance");
        payload.put("source", "manual");
        payload.put("status", "todo");
        payload.put("pipelineMedium", match.pipelineMedium());
        payload.put("priority", severity);
        payload.put("area", defaultText(match.area(), "未分区"));
        payload.put("createdBy", reportedBy);

        ArrayNode topologyChain = objectMapper.createArrayNode();
        topologyChain.add(match.featureId());
        if (match.segmentId() != null && !match.segmentId().isBlank()) {
            topologyChain.add(match.segmentId());
        }
        payload.set("topologyChain", topologyChain);

        ArrayNode segmentIds = objectMapper.createArrayNode();
        if (match.segmentId() != null && !match.segmentId().isBlank()) {
            segmentIds.add(match.segmentId());
        }
        payload.set("segmentIds", segmentIds);
        payload.set("nodeIds", objectMapper.createArrayNode());
        payload.set("roomIds", objectMapper.createArrayNode());
        payload.set("equipmentIds", objectMapper.createArrayNode());
        payload.set("linkedWorkorderIds", objectMapper.createArrayNode());

        ObjectNode maintenance = objectMapper.createObjectNode();
        maintenance.set("materials", objectMapper.createArrayNode());
        maintenance.set("steps", objectMapper.createArrayNode());
        maintenance.put("faultCause", note.isBlank() ? faultLabel(faultType) : note);
        maintenance.put("healthBefore", "待勘查");
        maintenance.put("healthAfter", "未修复");
        maintenance.set("acceptancePhotos", objectMapper.createArrayNode());
        maintenance.put("buildingRecoveryConfirmed", false);
        ObjectNode cost = objectMapper.createObjectNode();
        cost.put("laborCost", 0);
        cost.put("materialCost", 0);
        cost.put("durationHours", 0);
        cost.put("totalCost", 0);
        maintenance.set("cost", cost);
        payload.set("maintenance", maintenance);

        ArrayNode executionLogs = objectMapper.createArrayNode();
        ObjectNode createdLog = objectMapper.createObjectNode();
        createdLog.put("id", newLogId("LOG"));
        createdLog.put("stage", "created");
        createdLog.put("content", "快捷故障上报：" + faultLabel(faultType) + "（" + severity + "）" + withComment(note));
        createdLog.put("actor", reportedBy);
        createdLog.put("createdAt", OffsetDateTime.now().toString());
        ObjectNode location = objectMapper.createObjectNode();
        location.put("lng", lng);
        location.put("lat", lat);
        createdLog.set("location", location);
        createdLog.set("photoUrls", objectMapper.createArrayNode());
        createdLog.put("voiceUrl", "");
        createdLog.put("nodeId", "");
        createdLog.put("isMobileUpload", false);
        executionLogs.add(createdLog);
        payload.set("executionLogs", executionLogs);

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
        ObjectNode dashboard = defaultDashboard();

        ObjectNode totalsByType = (ObjectNode) dashboard.get("totalsByType");
        try {
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
        } catch (Exception ex) {
            logDashboardSectionFailure("totalsByType", query, ex);
        }

        ObjectNode totalsByStatus = (ObjectNode) dashboard.get("totalsByStatus");
        try {
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
        } catch (Exception ex) {
            logDashboardSectionFailure("totalsByStatus", query, ex);
        }

        ArrayNode topBuildings = objectMapper.createArrayNode();
        try {
            try {
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
            } catch (Exception primaryEx) {
                logDashboardSectionFailure("affectedBuildingsTop10.primary", query, primaryEx);
                List<Object> fallbackParams = new ArrayList<>(filter.params());
                StringBuilder fallbackTopBuildingsSql = new StringBuilder(
                        "SELECT COALESCE(w.building_name, w.building_id, '') AS building_name, COUNT(*) AS cnt, " +
                                "AVG(CASE WHEN w.started_at IS NOT NULL AND COALESCE(w.closed_at, w.finished_at, w.updated_at) > w.started_at " +
                                "THEN EXTRACT(EPOCH FROM (COALESCE(w.closed_at, w.finished_at, w.updated_at) - w.started_at))/3600.0 ELSE 0 END) AS avg_hours " +
                                "FROM work_order w " +
                                filter.whereSql()
                );
                if (query.buildingId() != null) {
                    fallbackTopBuildingsSql.append(" AND w.building_id = ? ");
                    fallbackParams.add(query.buildingId());
                }
                fallbackTopBuildingsSql.append("GROUP BY COALESCE(w.building_name, w.building_id, '') ORDER BY cnt DESC LIMIT 10");
                List<Map<String, Object>> fallbackRows = jdbcTemplate.queryForList(
                        fallbackTopBuildingsSql.toString(),
                        fallbackParams.toArray()
                );
                for (Map<String, Object> row : fallbackRows) {
                    ObjectNode item = objectMapper.createObjectNode();
                    item.put("buildingName", textValue(row.get("building_name")));
                    item.put("count", numberValue(row.get("cnt"), 0).intValue());
                    item.put("avgImpactHours", round(numberValue(row.get("avg_hours"), 0).doubleValue(), 2));
                    topBuildings.add(item);
                }
            }
        } catch (Exception ex) {
            logDashboardSectionFailure("affectedBuildingsTop10.fallback", query, ex);
        }
        dashboard.set("affectedBuildingsTop10", topBuildings);

        ObjectNode efficiency = (ObjectNode) dashboard.get("efficiency");
        double averageHandleHours = 0;
        int totalOrderCount = 0;
        int repeatedOrderCount = 0;
        double totalCost = 0;
        try {
            List<Object> completedParams = new ArrayList<>(filter.params());
            completedParams.add("completed");
            completedParams.add("closed");
            Double avg = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(AVG(CASE WHEN w.started_at IS NOT NULL AND COALESCE(w.finished_at, w.closed_at, w.updated_at) > w.started_at " +
                            "THEN EXTRACT(EPOCH FROM (COALESCE(w.finished_at, w.closed_at, w.updated_at) - w.started_at))/3600.0 ELSE 0 END), 0) " +
                            "FROM work_order w" + filter.whereSql() + " AND w.status IN (?, ?)",
                    completedParams.toArray(),
                    Double.class
            );
            averageHandleHours = avg == null ? 0 : avg;
        } catch (Exception ex) {
            logDashboardSectionFailure("efficiency.averageHandleHours", query, ex);
        }
        try {
            Integer totalOrders = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM work_order w" + filter.whereSql(),
                    filter.params().toArray(),
                    Integer.class
            );
            totalOrderCount = totalOrders == null ? 0 : totalOrders;
        } catch (Exception ex) {
            logDashboardSectionFailure("efficiency.totalOrders", query, ex);
        }
        try {
            Integer repeatedOrders = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(cnt),0) FROM (" +
                            "SELECT COUNT(*) AS cnt FROM work_order w" + filter.whereSql() +
                            " AND jsonb_typeof(w.segment_ids) = 'array' AND jsonb_array_length(w.segment_ids) > 0 " +
                            "GROUP BY w.segment_ids HAVING COUNT(*) > 1" +
                            ") t",
                    filter.params().toArray(),
                    Integer.class
            );
            repeatedOrderCount = repeatedOrders == null ? 0 : repeatedOrders;
        } catch (Exception ex) {
            logDashboardSectionFailure("efficiency.repeatedOrders", query, ex);
        }
        try {
            Double cost = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(CASE " +
                            "WHEN jsonb_typeof(w.maintenance_payload) = 'object' " +
                            " AND jsonb_typeof(w.maintenance_payload->'cost') = 'object' " +
                            " AND COALESCE(w.maintenance_payload->'cost'->>'totalCost', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' " +
                            "THEN (w.maintenance_payload->'cost'->>'totalCost')::numeric " +
                            "ELSE 0 END), 0) " +
                            "FROM work_order w" + filter.whereSql(),
                    filter.params().toArray(),
                    Double.class
            );
            totalCost = cost == null ? 0 : cost;
        } catch (Exception ex) {
            logDashboardSectionFailure("efficiency.totalCost", query, ex);
        }
        efficiency.put("averageHandleHours", round(averageHandleHours, 2));
        efficiency.put("repeatedOrderRate", totalOrderCount == 0 ? 0 : round((double) repeatedOrderCount / totalOrderCount, 2));
        efficiency.put("totalCost", round(totalCost, 2));
        dashboard.set("efficiency", efficiency);

        ArrayNode trend = objectMapper.createArrayNode();
        try {
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
        } catch (Exception ex) {
            logDashboardSectionFailure("trendByDay", query, ex);
        }
        dashboard.set("trendByDay", trend);

        ArrayNode inProgressHeatmap = objectMapper.createArrayNode();
        List<Map<String, Object>> heatRows = List.of();
        try {
            try {
                List<Object> heatmapParams = new ArrayList<>(filter.params());
                heatmapParams.add("in_progress");
                heatmapParams.add("paused");
                heatmapParams.add("review");
                heatRows = jdbcTemplate.queryForList(
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
            } catch (Exception primaryEx) {
                logDashboardSectionFailure("inProgressHeatmap.primary", query, primaryEx);
                List<Object> fallbackHeatmapParams = new ArrayList<>(filter.params());
                fallbackHeatmapParams.add("in_progress");
                fallbackHeatmapParams.add("paused");
                fallbackHeatmapParams.add("review");
                heatRows = jdbcTemplate.queryForList(
                        "SELECT w.id, w.title, w.building_id, COALESCE(w.building_name, '') AS building_name, " +
                                "119.1895 AS lon, 26.0254 AS lat " +
                                "FROM work_order w " +
                                filter.whereSql() + " AND w.status IN (?, ?, ?) ORDER BY w.updated_at DESC LIMIT 500",
                        fallbackHeatmapParams.toArray()
                );
            }
        } catch (Exception ex) {
            logDashboardSectionFailure("inProgressHeatmap.fallback", query, ex);
        }
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

    private ObjectNode defaultDashboard() {
        ObjectNode dashboard = objectMapper.createObjectNode();

        ObjectNode totalsByType = objectMapper.createObjectNode();
        for (String orderTypeName : ORDER_TYPES) {
            totalsByType.put(orderTypeName, 0);
        }
        dashboard.set("totalsByType", totalsByType);

        ObjectNode totalsByStatus = objectMapper.createObjectNode();
        for (String status : ORDER_STATUS) {
            totalsByStatus.put(status, 0);
        }
        dashboard.set("totalsByStatus", totalsByStatus);

        ObjectNode efficiency = objectMapper.createObjectNode();
        efficiency.put("averageHandleHours", 0);
        efficiency.put("repeatedOrderRate", 0);
        efficiency.put("totalCost", 0);
        dashboard.set("efficiency", efficiency);

        dashboard.set("affectedBuildingsTop10", objectMapper.createArrayNode());
        dashboard.set("trendByDay", objectMapper.createArrayNode());
        dashboard.set("inProgressHeatmap", objectMapper.createArrayNode());
        return dashboard;
    }

    private void logDashboardSectionFailure(String section, PipelineOrderListQuery query, Exception ex) {
        log.warn(
                "pipeline_ops_dashboard_section_failed section={} type={} status={} area={} buildingId={} assignee={}",
                section,
                query.type(),
                query.status(),
                query.area(),
                query.buildingId(),
                query.assignee(),
                ex
        );
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
            boolean success = isPumpControlSuccess(action, duration, beforeStatus);
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

    /**
     * Deterministic fallback until real pump control device response is integrated.
     * Keep workflow behavior stable and avoid random success/failure in logs/metrics.
     */
    private boolean isPumpControlSuccess(String action, int durationMinutes, String beforeStatus) {
        if (!Set.of("open", "close", "set_duration").contains(action)) return false;
        if ("set_duration".equals(action) && durationMinutes <= 0) return false;
        return !"fault".equalsIgnoreCase(defaultText(beforeStatus, ""));
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

    private PipeMatch findPipeMatchByFeatureId(String featureId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT g.id AS feature_id, " +
                        "COALESCE(g.properties->>'name', g.properties->>'ref', g.id) AS feature_name, " +
                        "COALESCE(g.properties->>'area', g.properties->>'campus', g.properties->>'source', '未分区') AS area, " +
                        "COALESCE(g.properties->>'pipelineMedium', g.properties->>'pipeLayer', g.properties->>'medium', g.properties->>'media', '') AS medium_raw, " +
                        "COALESCE(ps.id, '') AS segment_id " +
                        "FROM geo_features g " +
                        "LEFT JOIN pipe_segments ps ON ps.feature_id = g.id " +
                        "WHERE g.id = ? AND g.layer IN ('pipes', 'roads') " +
                        "ORDER BY ps.updated_at DESC NULLS LAST LIMIT 1",
                featureId
        );
        if (rows.isEmpty()) {
            return null;
        }
        return mapPipeMatch(rows.get(0));
    }

    private PipeMatch findNearestSegmentBackedPipeMatch(double lng, double lat) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "WITH src AS (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS geom) " +
                        "SELECT g.id AS feature_id, " +
                        "COALESCE(g.properties->>'name', g.properties->>'ref', g.id) AS feature_name, " +
                        "COALESCE(g.properties->>'area', g.properties->>'campus', g.properties->>'source', '未分区') AS area, " +
                        "COALESCE(g.properties->>'pipelineMedium', g.properties->>'pipeLayer', g.properties->>'medium', g.properties->>'media', '') AS medium_raw, " +
                        "ps.id AS segment_id " +
                        "FROM geo_features g " +
                        "JOIN pipe_segments ps ON ps.feature_id = g.id " +
                        "CROSS JOIN src " +
                        "WHERE g.layer IN ('pipes', 'roads') " +
                        "ORDER BY g.geom <-> src.geom " +
                        "LIMIT 1",
                lng,
                lat
        );
        if (rows.isEmpty()) {
            return null;
        }
        return mapPipeMatch(rows.get(0));
    }

    private PipeMatch findNearestPipeMatch(double lng, double lat) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "WITH src AS (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS geom) " +
                        "SELECT g.id AS feature_id, " +
                        "COALESCE(g.properties->>'name', g.properties->>'ref', g.id) AS feature_name, " +
                        "COALESCE(g.properties->>'area', g.properties->>'campus', g.properties->>'source', '未分区') AS area, " +
                        "COALESCE(g.properties->>'pipelineMedium', g.properties->>'pipeLayer', g.properties->>'medium', g.properties->>'media', '') AS medium_raw, " +
                        "COALESCE(ps.id, '') AS segment_id " +
                        "FROM geo_features g " +
                        "LEFT JOIN pipe_segments ps ON ps.feature_id = g.id " +
                        "CROSS JOIN src " +
                        "WHERE g.layer IN ('pipes', 'roads') " +
                        "ORDER BY g.geom <-> src.geom " +
                        "LIMIT 1",
                lng,
                lat
        );
        if (rows.isEmpty()) {
            return null;
        }
        return mapPipeMatch(rows.get(0));
    }

    private PipeMatch selectQuickReportPipeMatch(String featureId, double lng, double lat) {
        PipeMatch featureMatch = isBlank(featureId) ? null : findPipeMatchByFeatureId(featureId);
        if (featureMatch != null && !isBlank(featureMatch.segmentId())) {
            return featureMatch;
        }

        PipeMatch nearestSegmentMatch = findNearestSegmentBackedPipeMatch(lng, lat);
        if (nearestSegmentMatch != null) {
            return nearestSegmentMatch;
        }
        if (featureMatch != null) {
            return featureMatch;
        }
        return findNearestPipeMatch(lng, lat);
    }

    private PipeMatch mapPipeMatch(Map<String, Object> row) {
        return new PipeMatch(
                textValue(row.get("feature_id")),
                defaultText(textValue(row.get("feature_name")), textValue(row.get("feature_id"))),
                textValue(row.get("segment_id")),
                defaultText(textValue(row.get("area")), "未分区"),
                normalizeQuickReportMedium(textValue(row.get("medium_raw")))
        );
    }

    private String normalizeQuickReportMedium(String raw) {
        String value = defaultText(raw, "").toLowerCase(Locale.ROOT);
        if (value.contains("sewage") || value.contains("sewer") || value.contains("污")) {
            return "sewage";
        }
        if (value.contains("drain") || value.contains("storm") || value.contains("rain") || value.contains("排") || value.contains("雨")) {
            return "drainage";
        }
        if (value.contains("water") || value.contains("给") || value.contains("供")) {
            return "water";
        }
        return "mixed";
    }

    private String buildQuickReportTitle(String featureName, String faultType, String severity) {
        String level = switch (severity) {
            case "high" -> "高";
            case "low" -> "低";
            default -> "中";
        };
        return "故障上报[" + level + "] " + faultLabel(faultType) + " - " + defaultText(featureName, "未命名管线");
    }

    private String faultLabel(String faultType) {
        return switch (faultType) {
            case "leak" -> "漏水";
            case "burst" -> "破裂";
            case "blockage" -> "堵塞";
            default -> "其他故障";
        };
    }

    // Keep the reflective test contract on the repository while the implementation lives in the support base.
    protected String nextWorkorderId(String type) {
        return super.nextWorkorderId(type);
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
