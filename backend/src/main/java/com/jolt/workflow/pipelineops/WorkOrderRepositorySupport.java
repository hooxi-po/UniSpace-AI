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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

abstract class WorkOrderRepositorySupport {

    protected static final Set<String> ORDER_TYPES = Set.of("inspection", "maintenance", "retrofit", "retire");
    protected static final Set<String> ORDER_STATUS = Set.of(
            "draft", "todo", "assigned", "in_progress", "paused", "review", "completed", "closed", "cancelled", "rejected"
    );
    protected static final Set<String> ORDER_PRIORITY = Set.of("low", "medium", "high", "urgent");
    protected static final Set<String> ORDER_MEDIUM = Set.of("water", "drainage", "sewage", "mixed");
    protected static final Set<String> ORDER_SOURCE = Set.of(
            "manual", "telemetry_alert", "anomaly_alert", "kg_inference", "inspection_transfer"
    );

    protected static final long CACHE_TTL_MS = 5L * 60L * 1000L;
    protected static final int MAX_CACHE_ENTRIES = 1000;
    protected static final int CACHE_CLEANUP_BATCH = 128;
    protected static final int DEFAULT_LIMIT = 20;
    protected static final int MAX_LIMIT = 200;

    protected final JdbcTemplate jdbcTemplate;
    protected final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    protected WorkOrderRepositorySupport(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    protected void syncBuildingLinks(String workOrderId, JsonNode impactedBuildings, boolean manualAdjusted) {
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

    protected void insertExecutionLog(String workOrderId, ObjectNode log) {
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

    protected void insertPumpControlLog(String workOrderId, ObjectNode row) {
        insertPumpControlLog(workOrderId, row, false);
    }

    protected void insertPumpControlLog(String workOrderId, ObjectNode row, boolean fromMigration) {
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

    protected ObjectNode normalizePumpControlLog(JsonNode raw, String actor, int total, boolean fromMigration) {
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

    protected ObjectNode normalizeExecutionLog(JsonNode raw, String actor) {
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

    protected ObjectNode createDefaultCreatedLog(ObjectNode workorder) {
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

    protected void touchWorkorder(String id) {
        jdbcTemplate.update("UPDATE work_order SET updated_at = now() WHERE id = ?", id);
    }

    protected String queryLatestPumpStatus(String buildingId) {
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

    protected String resolveBuildingName(JsonNode impactedBuildings, String buildingId) {
        for (JsonNode node : array(impactedBuildings)) {
            if (buildingId.equals(text(node.get("buildingId")))) {
                String name = text(node.get("buildingName"));
                return name == null ? buildingId : name;
            }
        }
        return buildingId;
    }

    protected ObjectNode normalizeWorkOrderInput(JsonNode body, ObjectNode existing, String id, boolean isNew) {
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

        List<String> rawTopologyChain = toTextList(arrayOrDefault(body.get("topologyChain"), existing == null ? null : existing.get("topologyChain")));
        List<String> rawNodeIds = toTextList(arrayOrDefault(body.get("nodeIds"), existing == null ? null : existing.get("nodeIds")));
        List<String> rawSegmentIds = toTextList(arrayOrDefault(body.get("segmentIds"), existing == null ? null : existing.get("segmentIds")));
        validateExplicitAssetReferences(
                body.has("nodeIds") ? toTextList(body.get("nodeIds")) : List.of(),
                body.has("segmentIds") ? toTextList(body.get("segmentIds")) : List.of(),
                body.has("buildingId") ? defaultText(text(body.get("buildingId")), "") : "",
                body.has("buildingName") ? defaultText(text(body.get("buildingName")), "") : ""
        );
        List<String> canonicalNodeIds = resolveCanonicalNodeIds(rawNodeIds);
        List<SegmentAssetRef> canonicalSegments = resolveSegmentAssets(rawSegmentIds);
        List<String> canonicalSegmentIds = new ArrayList<>();
        LinkedHashSet<String> canonicalTopologyChain = new LinkedHashSet<>();

        canonicalTopologyChain.addAll(normalizeDistinctIds(rawTopologyChain));
        for (String nodeId : canonicalNodeIds) {
            canonicalTopologyChain.add(nodeId);
        }
        for (SegmentAssetRef segment : canonicalSegments) {
            if (!isBlank(segment.id())) {
                canonicalSegmentIds.add(segment.id());
                canonicalTopologyChain.add(segment.id());
            }
            if (!isBlank(segment.featureId())) canonicalTopologyChain.add(segment.featureId());
        }
        normalized.set("topologyChain", textArray(new ArrayList<>(canonicalTopologyChain)));
        normalized.set("nodeIds", textArray(canonicalNodeIds));
        normalized.set("segmentIds", textArray(canonicalSegmentIds));

        String rawBuildingId = defaultText(text(body.get("buildingId")), existing == null ? "" : existing.path("buildingId").asText(""));
        String rawBuildingName = defaultText(text(body.get("buildingName")), existing == null ? "" : existing.path("buildingName").asText(""));
        BuildingSeed canonicalBuilding = resolveBuildingSeed(rawBuildingId, rawBuildingName);
        normalized.put("buildingId", canonicalBuilding == null ? "" : canonicalBuilding.id());
        normalized.put("buildingName", canonicalBuilding == null ? rawBuildingName : canonicalBuilding.name());

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

    protected ObjectNode inferImpactScope(String buildingId, String buildingName, List<String> nodeIds, List<String> segmentIds, String medium) {
        List<String> normalizedNodeIds = normalizeDistinctIds(nodeIds);
        List<String> normalizedSegmentInputs = normalizeDistinctIds(segmentIds);
        List<SegmentAssetRef> resolvedSegments = resolveSegmentAssets(normalizedSegmentInputs);
        LinkedHashSet<String> relationCandidateIds = new LinkedHashSet<>(normalizedSegmentInputs);
        LinkedHashSet<String> relationNodeIds = new LinkedHashSet<>(normalizedNodeIds);
        for (SegmentAssetRef segment : resolvedSegments) {
            relationCandidateIds.add(segment.id());
            if (!isBlank(segment.featureId())) relationCandidateIds.add(segment.featureId());
            if (!isBlank(segment.fromNodeId())) relationNodeIds.add(segment.fromNodeId());
            if (!isBlank(segment.toNodeId())) relationNodeIds.add(segment.toNodeId());
        }
        relationCandidateIds.addAll(relationNodeIds);

        LinkedHashMap<String, BuildingSeed> candidates = new LinkedHashMap<>();
        BuildingSeed directBuilding = resolveBuildingSeed(buildingId, buildingName);
        if (directBuilding != null) {
            candidates.put(directBuilding.id(), directBuilding);
        }
        for (String relatedBuildingId : resolveBuildingIdsByAssets(relationCandidateIds)) {
            BuildingSeed seed = resolveBuildingSeed(relatedBuildingId, null);
            if (seed != null) {
                candidates.put(seed.id(), seed);
            }
        }

        ArrayNode impactedBuildings = buildImpactedBuildings(candidates.values());

        ObjectNode scope = objectMapper.createObjectNode();
        scope.set("impactedBuildings", impactedBuildings);
        scope.put("bypassRequirement", buildBypassRequirement(medium, impactedBuildings));
        scope.put("manualAdjusted", false);
        scope.set("adjustmentLogs", objectMapper.createArrayNode());
        return scope;
    }

    protected List<String> normalizeDistinctIds(List<String> rawIds) {
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (String rawId : rawIds) {
            String id = defaultText(rawId, "");
            if (!id.isBlank()) ids.add(id);
        }
        return new ArrayList<>(ids);
    }

    protected ArrayNode textArray(List<String> values) {
        ArrayNode array = objectMapper.createArrayNode();
        for (String value : normalizeDistinctIds(values)) {
            array.add(value);
        }
        return array;
    }

    protected List<String> resolveCanonicalNodeIds(List<String> rawNodeIds) {
        List<String> ids = normalizeDistinctIds(rawNodeIds);
        if (ids.isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "SELECT id FROM pipe_nodes WHERE id IN (" + placeholders + ") OR feature_id IN (" + placeholders + ") ORDER BY id";
        List<Object> params = new ArrayList<>(ids.size() * 2);
        params.addAll(ids);
        params.addAll(ids);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        LinkedHashSet<String> resolved = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            String id = textValue(row.get("id"));
            if (!id.isBlank()) resolved.add(id);
        }
        return new ArrayList<>(resolved);
    }

    protected void validateExplicitAssetReferences(List<String> rawNodeIds, List<String> rawSegmentIds, String rawBuildingId, String rawBuildingName) {
        rejectUnknownNodeIds(rawNodeIds);
        rejectUnknownSegmentIds(rawSegmentIds);

        String buildingId = defaultText(rawBuildingId, "");
        String buildingName = defaultText(rawBuildingName, "");
        if (buildingId.isBlank() && buildingName.isBlank()) {
            return;
        }

        if (findExistingBuildingSeed(buildingId, buildingName) == null) {
            throw badRequest("building_id_invalid");
        }
    }

    protected void rejectUnknownNodeIds(List<String> rawNodeIds) {
        List<String> ids = normalizeDistinctIds(rawNodeIds);
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "SELECT id, COALESCE(feature_id, '') AS feature_id FROM pipe_nodes " +
                "WHERE id IN (" + placeholders + ") OR feature_id IN (" + placeholders + ")";
        List<Object> params = new ArrayList<>(ids.size() * 2);
        params.addAll(ids);
        params.addAll(ids);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        Set<String> matched = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            String id = textValue(row.get("id"));
            String featureId = textValue(row.get("feature_id"));
            if (!id.isBlank()) matched.add(id);
            if (!featureId.isBlank()) matched.add(featureId);
        }
        List<String> unknown = ids.stream().filter(id -> !matched.contains(id)).toList();
        if (!unknown.isEmpty()) {
            throw badRequest("node_ids_invalid");
        }
    }

    protected void rejectUnknownSegmentIds(List<String> rawSegmentIds) {
        List<String> ids = normalizeDistinctIds(rawSegmentIds);
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "SELECT id, COALESCE(feature_id, '') AS feature_id FROM pipe_segments " +
                "WHERE id IN (" + placeholders + ") OR feature_id IN (" + placeholders + ")";
        List<Object> params = new ArrayList<>(ids.size() * 2);
        params.addAll(ids);
        params.addAll(ids);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        Set<String> matched = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            String id = textValue(row.get("id"));
            String featureId = textValue(row.get("feature_id"));
            if (!id.isBlank()) matched.add(id);
            if (!featureId.isBlank()) matched.add(featureId);
        }
        List<String> unknown = ids.stream().filter(id -> !matched.contains(id)).toList();
        if (!unknown.isEmpty()) {
            throw badRequest("segment_ids_invalid");
        }
    }

    protected List<String> resolveCanonicalSegmentIds(List<String> rawSegmentIds) {
        List<SegmentAssetRef> segments = resolveSegmentAssets(rawSegmentIds);
        LinkedHashSet<String> resolved = new LinkedHashSet<>();
        for (SegmentAssetRef segment : segments) {
            if (!isBlank(segment.id())) resolved.add(segment.id());
        }
        return new ArrayList<>(resolved);
    }

    protected List<SegmentAssetRef> resolveSegmentAssets(List<String> rawSegmentIds) {
        List<String> ids = normalizeDistinctIds(rawSegmentIds);
        if (ids.isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "SELECT ps.id, COALESCE(ps.feature_id, '') AS feature_id, COALESCE(ps.from_node_id, '') AS from_node_id, COALESCE(ps.to_node_id, '') AS to_node_id " +
                "FROM pipe_segments ps " +
                "WHERE ps.id IN (" + placeholders + ") OR ps.feature_id IN (" + placeholders + ") " +
                "ORDER BY ps.id";
        List<Object> params = new ArrayList<>(ids.size() * 2);
        params.addAll(ids);
        params.addAll(ids);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        LinkedHashMap<String, SegmentAssetRef> resolved = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            SegmentAssetRef ref = new SegmentAssetRef(
                    textValue(row.get("id")),
                    textValue(row.get("feature_id")),
                    textValue(row.get("from_node_id")),
                    textValue(row.get("to_node_id"))
            );
            if (!ref.id().isBlank()) {
                resolved.put(ref.id(), ref);
            }
        }
        return new ArrayList<>(resolved.values());
    }

    protected ObjectNode buildImpactAnalysisResponse(String buildingId, String buildingName, List<String> nodeIds, List<String> segmentIds, String medium) {
        ObjectNode scope = inferImpactScope(buildingId, buildingName, nodeIds, segmentIds, medium);
        ArrayNode impactedBuildings = array(scope.get("impactedBuildings"));
        int roomCount = 0;
        for (JsonNode building : impactedBuildings) {
            roomCount += array(building.get("rooms")).size();
        }

        ObjectNode result = objectMapper.createObjectNode();
        result.set("impactedBuildings", impactedBuildings.deepCopy());
        result.put("estimatedImpactHours", inferImpactHours(defaultText(medium, "mixed"), impactedBuildings.size(), roomCount));
        result.put("affectedUserCount", inferAffectedUsers(defaultText(medium, "mixed"), roomCount, impactedBuildings.size()));
        return result;
    }

    protected int inferImpactHours(String medium, int buildingCount, int roomCount) {
        int base = switch (defaultText(medium, "mixed")) {
            case "sewage" -> 5;
            case "water" -> 4;
            case "drainage" -> 3;
            default -> 4;
        };
        int load = Math.min(4, (int) Math.ceil(roomCount / 8.0)) + Math.max(0, buildingCount - 1);
        return Math.max(1, base + load);
    }

    protected int inferAffectedUsers(String medium, int roomCount, int buildingCount) {
        int perRoom = switch (defaultText(medium, "mixed")) {
            case "water" -> 6;
            case "sewage" -> 4;
            case "drainage" -> 3;
            default -> 5;
        };
        if (roomCount > 0) return roomCount * perRoom;
        return buildingCount * perRoom * 6;
    }

    protected LinkedHashSet<String> resolveBuildingIdsByAssets(Set<String> assetIds) {
        LinkedHashSet<String> buildingIds = new LinkedHashSet<>();
        if (assetIds.isEmpty()) return buildingIds;
        String placeholders = String.join(",", java.util.Collections.nCopies(assetIds.size(), "?"));
        String sql = "SELECT DISTINCT CASE " +
                "  WHEN source_type = 'building' THEN source_id " +
                "  WHEN target_type = 'building' THEN target_id " +
                "  ELSE NULL END AS building_id " +
                "FROM asset_relations " +
                "WHERE (source_id IN (" + placeholders + ") OR target_id IN (" + placeholders + ")) " +
                "  AND (source_type = 'building' OR target_type = 'building')";
        List<Object> params = new ArrayList<>(assetIds.size() * 2);
        params.addAll(assetIds);
        params.addAll(assetIds);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            String buildingId = textValue(row.get("building_id"));
            if (!buildingId.isBlank()) buildingIds.add(buildingId);
        }
        return buildingIds;
    }

    protected BuildingSeed findExistingBuildingSeed(String buildingId, String buildingName) {
        String resolvedBuildingId = defaultText(buildingId, "");
        String resolvedBuildingName = defaultText(buildingName, "");

        if (!resolvedBuildingId.isBlank()) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT code AS building_id, building_name FROM buildings WHERE code = ? LIMIT 1",
                    resolvedBuildingId
            );
            if (!rows.isEmpty()) {
                return new BuildingSeed(
                        textValue(rows.get(0).get("building_id")),
                        defaultText(textValue(rows.get(0).get("building_name")), resolvedBuildingId)
                );
            }

            rows = jdbcTemplate.queryForList(
                    "SELECT id AS building_id, COALESCE(properties->>'name', properties->>'buildingName', id) AS building_name " +
                            "FROM geo_features WHERE layer = 'buildings' AND id = ? LIMIT 1",
                    resolvedBuildingId
            );
            if (!rows.isEmpty()) {
                return new BuildingSeed(
                        textValue(rows.get(0).get("building_id")),
                        defaultText(textValue(rows.get(0).get("building_name")), resolvedBuildingId)
                );
            }
        }

        if (!resolvedBuildingName.isBlank()) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT code AS building_id, building_name FROM buildings WHERE LOWER(building_name) = LOWER(?) LIMIT 1",
                    resolvedBuildingName
            );
            if (!rows.isEmpty()) {
                return new BuildingSeed(
                        textValue(rows.get(0).get("building_id")),
                        defaultText(textValue(rows.get(0).get("building_name")), resolvedBuildingName)
                );
            }

            rows = jdbcTemplate.queryForList(
                    "SELECT id AS building_id, COALESCE(properties->>'name', properties->>'buildingName', id) AS building_name " +
                            "FROM geo_features WHERE layer = 'buildings' AND LOWER(COALESCE(properties->>'name', properties->>'buildingName', id)) = LOWER(?) LIMIT 1",
                    resolvedBuildingName
            );
            if (!rows.isEmpty()) {
                return new BuildingSeed(
                        textValue(rows.get(0).get("building_id")),
                        defaultText(textValue(rows.get(0).get("building_name")), resolvedBuildingName)
                );
            }
        }

        return null;
    }

    protected BuildingSeed resolveBuildingSeed(String buildingId, String buildingName) {
        BuildingSeed existing = findExistingBuildingSeed(buildingId, buildingName);
        if (existing != null) {
            return existing;
        }

        String resolvedBuildingId = defaultText(buildingId, "");
        String resolvedBuildingName = defaultText(buildingName, "");
        if (!resolvedBuildingId.isBlank()) {
            return new BuildingSeed(resolvedBuildingId, resolvedBuildingName.isBlank() ? resolvedBuildingId : resolvedBuildingName);
        }
        if (!resolvedBuildingName.isBlank()) {
            return new BuildingSeed(resolvedBuildingName, resolvedBuildingName);
        }
        return null;
    }

    protected ArrayNode buildImpactedBuildings(Iterable<BuildingSeed> seeds) {
        ArrayNode impactedBuildings = objectMapper.createArrayNode();
        for (BuildingSeed seed : seeds) {
            ArrayNode roomArr = objectMapper.createArrayNode();
            Set<Integer> floors = new HashSet<>();

            List<Map<String, Object>> buildingRooms = jdbcTemplate.queryForList(
                    "SELECT r.id, r.room_no, f.floor_no " +
                            "FROM building_rooms r " +
                            "LEFT JOIN building_floors f ON f.id = r.floor_id " +
                            "WHERE r.building_id = ? " +
                            "ORDER BY f.floor_no NULLS LAST, r.room_no LIMIT 24",
                    seed.id()
            );
            for (Map<String, Object> room : buildingRooms) {
                ObjectNode node = objectMapper.createObjectNode();
                node.put("buildingId", seed.id());
                node.put("buildingName", seed.name());
                Object floorNo = room.get("floor_no");
                if (floorNo instanceof Number number) {
                    int floor = number.intValue();
                    floors.add(floor);
                    node.put("floorNo", floor);
                } else {
                    node.set("floorNo", objectMapper.nullNode());
                }
                String roomNo = textValue(room.get("room_no"));
                node.put("roomNo", roomNo);
                node.put("roomId", textValue(room.get("id")));
                ArrayNode equipmentIds = objectMapper.createArrayNode();
                if (!isBlank(roomNo)) {
                    equipmentIds.add("PUMP-" + roomNo);
                }
                node.set("equipmentIds", equipmentIds);
                roomArr.add(node);
            }

            if (roomArr.isEmpty()) {
                List<Map<String, Object>> legacyRooms = jdbcTemplate.queryForList(
                        "SELECT id, room_no, floor FROM rooms WHERE building_code = ? ORDER BY floor, room_no LIMIT 24",
                        seed.id()
                );
                for (Map<String, Object> room : legacyRooms) {
                    ObjectNode node = objectMapper.createObjectNode();
                    node.put("buildingId", seed.id());
                    node.put("buildingName", seed.name());
                    if (room.get("floor") instanceof Number number) {
                        int floor = number.intValue();
                        floors.add(floor);
                        node.put("floorNo", floor);
                    } else {
                        node.set("floorNo", objectMapper.nullNode());
                    }
                    String roomNo = textValue(room.get("room_no"));
                    node.put("roomNo", roomNo);
                    node.put("roomId", textValue(room.get("id")));
                    ArrayNode equipmentIds = objectMapper.createArrayNode();
                    if (!isBlank(roomNo)) {
                        equipmentIds.add("PUMP-" + roomNo);
                    }
                    node.set("equipmentIds", equipmentIds);
                    roomArr.add(node);
                }
            }

            ObjectNode building = objectMapper.createObjectNode();
            building.put("buildingId", seed.id());
            building.put("buildingName", seed.name());
            ArrayNode floorArr = objectMapper.createArrayNode();
            floors.stream().sorted().forEach(floorArr::add);
            building.set("floors", floorArr);
            building.set("rooms", roomArr);
            impactedBuildings.add(building);
        }
        return impactedBuildings;
    }

    protected String buildBypassRequirement(String medium, ArrayNode impactedBuildings) {
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

    protected boolean isValidTransition(String current, String action) {
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

    protected boolean hasAbnormalInspectionRecord(JsonNode recordsNode) {
        if (recordsNode == null || !recordsNode.isArray()) return false;
        for (JsonNode record : recordsNode) {
            if ("abnormal".equalsIgnoreCase(defaultText(text(record.get("judgement")), ""))) {
                return true;
            }
        }
        return false;
    }

    protected boolean shouldReopenToTodo(String current) {
        return Set.of("draft", "todo", "assigned", "cancelled", "rejected").contains(current);
    }

    protected ObjectNode mapWorkOrder(Map<String, Object> row) {
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

    protected ObjectNode defaultImpactScope() {
        ObjectNode node = objectMapper.createObjectNode();
        node.set("impactedBuildings", objectMapper.createArrayNode());
        node.put("bypassRequirement", "");
        node.put("manualAdjusted", false);
        node.set("adjustmentLogs", objectMapper.createArrayNode());
        return node;
    }

    protected String nextWorkorderId(String type) {
        String prefix = switch (type == null ? "" : type) {
            case "inspection" -> "INS";
            case "maintenance" -> "MAI";
            case "retrofit" -> "RET";
            case "retire" -> "SCR";
            default -> "OPS";
        };
        return "WO-" + prefix + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    protected String newLogId(String prefix) {
        return prefix + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
    }

    protected void invalidateCache() {
        cache.clear();
    }

    protected JsonNode readCache(String key) {
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;
        if (System.currentTimeMillis() > entry.expireAt()) {
            cache.remove(key);
            return null;
        }
        return entry.data().deepCopy();
    }

    protected void saveCache(String key, JsonNode value) {
        if (!cache.containsKey(key)) {
            trimCacheIfNeeded();
        }
        cache.put(key, new CacheEntry(System.currentTimeMillis() + CACHE_TTL_MS, value.deepCopy()));
    }

    protected void trimCacheIfNeeded() {
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

    protected RuntimeException badRequest(String message) {
        return new WorkOrderRepository.PipelineOpsException(400, message);
    }

    protected RuntimeException notFound(String message) {
        return new WorkOrderRepository.PipelineOpsException(404, message);
    }

    protected ArrayNode parseJsonArray(Object raw) {
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

    protected ObjectNode parseJsonObject(Object raw, ObjectNode fallback) {
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

    protected ObjectNode parseJsonObjectOrNull(Object raw) {
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

    protected String jsonText(JsonNode node) {
        if (node == null || node.isNull()) return "null";
        return node.toString();
    }

    protected ArrayNode array(JsonNode node) {
        if (node != null && node.isArray()) return (ArrayNode) node;
        return objectMapper.createArrayNode();
    }

    protected ArrayNode arrayOrDefault(JsonNode primary, JsonNode fallback) {
        if (primary != null && primary.isArray()) return (ArrayNode) primary.deepCopy();
        if (fallback != null && fallback.isArray()) return (ArrayNode) fallback.deepCopy();
        return objectMapper.createArrayNode();
    }

    protected ObjectNode objectNode(JsonNode node) {
        if (node != null && node.isObject()) return (ObjectNode) node;
        return null;
    }

    protected JsonNode objectOrNull(JsonNode primary, JsonNode fallback) {
        if (primary != null && primary.isObject()) return primary.deepCopy();
        if (fallback != null && fallback.isObject()) return fallback.deepCopy();
        return objectMapper.nullNode();
    }

    protected List<String> toTextList(JsonNode arrayNode) {
        List<String> list = new ArrayList<>();
        if (arrayNode == null || !arrayNode.isArray()) return list;
        for (JsonNode node : arrayNode) {
            String value = text(node);
            if (value != null && !value.isBlank()) list.add(value);
        }
        return list;
    }

    protected String text(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) {
            String value = node.asText();
            return value == null ? null : value.trim();
        }
        if (node.isNumber() || node.isBoolean()) return String.valueOf(node.asText()).trim();
        return null;
    }

    protected String textValue(Object value) {
        if (value == null) return "";
        return String.valueOf(value);
    }

    protected String nullableTextValue(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        return text == null ? "" : text;
    }

    protected String textFromDate(Object value) {
        if (value == null) return "";
        if (value instanceof Date d) return d.toLocalDate().toString();
        return String.valueOf(value);
    }

    protected String textFromTimestamp(Object value) {
        if (value == null) return "";
        if (value instanceof OffsetDateTime odt) return odt.toString();
        if (value instanceof Timestamp ts) return ts.toInstant().toString();
        return String.valueOf(value);
    }

    protected String textValue(JsonNode node) {
        return node == null || node.isNull() ? "" : node.asText("");
    }

    protected String defaultText(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value.trim();
    }

    protected boolean isDateOnly(String value) {
        if (value == null || value.isBlank()) return false;
        String trimmed = value.trim();
        try {
            return trimmed.length() == 10 && LocalDate.parse(trimmed).toString().equals(trimmed);
        } catch (DateTimeParseException ex) {
            return false;
        }
    }

    protected String normalizeCreatedAtFilter(String value, String fieldName) {
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

    protected boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    protected String withComment(String comment) {
        if (comment == null || comment.isBlank()) return "";
        return "；" + comment.trim();
    }

    protected String nullableText(JsonNode node) {
        String value = text(node);
        if (value == null || value.isBlank()) return null;
        return value;
    }

    protected String normalizeDateText(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            return LocalDate.parse(trimmed).toString();
        } catch (DateTimeParseException ex) {
            throw badRequest(fieldName + "_invalid_date");
        }
    }

    protected String normalizeTimestampText(String value, String fieldName) {
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

    protected String nullableDate(JsonNode node, String fieldName) {
        return normalizeDateText(text(node), fieldName);
    }

    protected String nullableTimestamp(JsonNode node, String fieldName) {
        return normalizeTimestampText(text(node), fieldName);
    }

    protected Integer nullableInt(JsonNode node) {
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

    protected Number nullableNumber(JsonNode node) {
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

    protected Number numberValue(Object raw, Number defaultValue) {
        if (raw == null) return defaultValue;
        if (raw instanceof Number n) return n;
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (Exception e) {
            return defaultValue;
        }
    }

    protected int clamp(Integer value, int min, int max, int defaultValue) {
        if (value == null) return defaultValue;
        return Math.max(min, Math.min(max, value));
    }

    protected double round(double value, int precision) {
        double scale = Math.pow(10, precision);
        return Math.round(value * scale) / scale;
    }

    protected static record BuildingSeed(String id, String name) {
    }

    protected static record SegmentAssetRef(String id, String featureId, String fromNodeId, String toNodeId) {
    }

    private record CacheEntry(long expireAt, JsonNode data) {
    }
}
