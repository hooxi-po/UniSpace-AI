package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/twin")
public class TwinController {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public TwinController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = "/drilldown/{featureId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode drilldown(@PathVariable("featureId") String featureId) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("featureId", featureId);
        root.set("feature", queryFeatureGeoJson(featureId));

        ObjectNode segment = querySegmentByFeature(featureId);
        if (segment == null) root.putNull("segment");
        else root.set("segment", segment);

        Set<String> candidateAssetIds = new LinkedHashSet<>();
        candidateAssetIds.add(featureId);
        if (segment != null && segment.hasNonNull("id")) {
            candidateAssetIds.add(segment.get("id").asText());
        }

        ArrayNode nodes = queryNodesByCandidates(candidateAssetIds);
        root.set("nodes", nodes);
        for (JsonNode node : nodes) {
            if (node.hasNonNull("id")) candidateAssetIds.add(node.get("id").asText());
        }

        ArrayNode relations = queryRelationsByCandidates(candidateAssetIds);
        root.set("relations", relations);
        root.set("linkedBuildings", queryLinkedBuildings(relations, featureId));
        return root;
    }

    @GetMapping(value = "/trace", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode trace(
            @RequestParam("startId") String startId,
            @RequestParam(name = "direction", required = false, defaultValue = "down") String directionRaw
    ) {
        String direction = "up".equalsIgnoreCase(directionRaw) ? "up" : "down";
        List<SegmentTopology> segments = queryAllSegments();

        SegmentTopology startSegment = segments.stream()
                .filter(s -> Objects.equals(s.id(), startId) || Objects.equals(s.featureId(), startId))
                .findFirst()
                .orElse(null);

        ObjectNode root = objectMapper.createObjectNode();
        root.put("startId", startId);
        root.put("direction", direction);

        ArrayNode pathSegmentIds = objectMapper.createArrayNode();
        ArrayNode pathFeatureIds = objectMapper.createArrayNode();
        ArrayNode nodeIds = objectMapper.createArrayNode();

        if (startSegment == null) {
            root.set("pathSegmentIds", pathSegmentIds);
            root.set("pathFeatureIds", pathFeatureIds);
            root.set("nodeIds", nodeIds);
            root.set("linkedBuildings", objectMapper.createArrayNode());
            return root;
        }

        Set<String> visitedSegmentIds = new LinkedHashSet<>();
        Set<String> visitedFeatureIds = new LinkedHashSet<>();
        Set<String> visitedNodeIds = new LinkedHashSet<>();
        ArrayDeque<SegmentTopology> queue = new ArrayDeque<>();
        queue.add(startSegment);
        visitedSegmentIds.add(startSegment.id());
        if (startSegment.featureId() != null && !startSegment.featureId().isBlank()) {
            visitedFeatureIds.add(startSegment.featureId());
        }
        if (startSegment.fromNodeId() != null) visitedNodeIds.add(startSegment.fromNodeId());
        if (startSegment.toNodeId() != null) visitedNodeIds.add(startSegment.toNodeId());

        while (!queue.isEmpty()) {
            SegmentTopology current = queue.removeFirst();
            for (SegmentTopology next : segments) {
                if (visitedSegmentIds.contains(next.id())) continue;
                boolean linked;
                if ("up".equals(direction)) {
                    linked = current.fromNodeId() != null
                            && next.toNodeId() != null
                            && current.fromNodeId().equals(next.toNodeId());
                } else {
                    linked = current.toNodeId() != null
                            && next.fromNodeId() != null
                            && current.toNodeId().equals(next.fromNodeId());
                }
                if (!linked) continue;

                visitedSegmentIds.add(next.id());
                if (next.featureId() != null && !next.featureId().isBlank()) {
                    visitedFeatureIds.add(next.featureId());
                }
                if (next.fromNodeId() != null) visitedNodeIds.add(next.fromNodeId());
                if (next.toNodeId() != null) visitedNodeIds.add(next.toNodeId());
                queue.addLast(next);
            }
        }

        for (String segmentId : visitedSegmentIds) pathSegmentIds.add(segmentId);
        for (String featureId : visitedFeatureIds) pathFeatureIds.add(featureId);
        for (String nodeId : visitedNodeIds) nodeIds.add(nodeId);

        Set<String> candidateIds = new LinkedHashSet<>();
        candidateIds.addAll(visitedSegmentIds);
        candidateIds.addAll(visitedFeatureIds);
        candidateIds.addAll(visitedNodeIds);
        ArrayNode relations = queryRelationsByCandidates(candidateIds);

        root.set("pathSegmentIds", pathSegmentIds);
        root.set("pathFeatureIds", pathFeatureIds);
        root.set("nodeIds", nodeIds);
        root.set("linkedBuildings", queryLinkedBuildings(relations, startId));
        return root;
    }

    @GetMapping(value = "/telemetry/latest", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode telemetryLatest(@RequestParam("featureIds") String featureIdsRaw) {
        List<String> featureIds = List.of(featureIdsRaw.split(",")).stream()
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode list = objectMapper.createArrayNode();
        root.set("list", list);
        if (featureIds.isEmpty()) return root;

        String placeholders = String.join(",", java.util.Collections.nCopies(featureIds.size(), "?"));
        String sql = "SELECT point_id, feature_id, metric, value, COALESCE(unit, '') AS unit, sampled_at, quality, source " +
                "FROM telemetry_latest WHERE feature_id IN (" + placeholders + ") " +
                "ORDER BY sampled_at DESC";
        Object[] params = featureIds.toArray();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);
        for (Map<String, Object> row : rows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("pointId", String.valueOf(row.get("point_id")));
            item.put("featureId", String.valueOf(row.get("feature_id")));
            item.put("metric", String.valueOf(row.get("metric")));
            item.put("value", ((Number) row.get("value")).doubleValue());
            item.put("unit", String.valueOf(row.get("unit")));
            item.put("sampledAt", String.valueOf(row.get("sampled_at")));
            item.put("quality", String.valueOf(row.get("quality")));
            item.put("source", String.valueOf(row.get("source")));
            list.add(item);
        }
        return root;
    }

    @PutMapping(value = "/pipes/{id}/geometry", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> updatePipeGeometry(
            @PathVariable("id") String id,
            @RequestBody String body
    ) {
        String featureId = resolvePipeFeatureId(id);
        if (featureId == null) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_json"));
        }

        JsonNode geometryNode = root.get("geometry");
        if (geometryNode == null || !geometryNode.isObject()) {
            return ResponseEntity.badRequest().body(errorNode("geometry_required"));
        }
        String updatedBy = parseUpdatedBy(root);
        JsonNode before = queryFeatureGeoJson(featureId);

        int updated;
        try {
            updated = jdbcTemplate.update(
                    "UPDATE geo_features SET geom = ST_SetSRID(ST_GeomFromGeoJSON(?), 4326) WHERE id = ?",
                    geometryNode.toString(),
                    featureId
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_geometry"));
        }
        if (updated == 0) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        try {
            syncTopologyForFeature(featureId);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(errorNode("topology_sync_failed"));
        }

        JsonNode after = queryFeatureGeoJson(featureId);
        insertAuditLog(featureId, "geometry_update", updatedBy, before, after);

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("id", featureId);
        ok.put("action", "geometry_update");
        return ResponseEntity.ok(ok);
    }

    @PutMapping(value = "/pipes/{id}/properties", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> updatePipeProperties(
            @PathVariable("id") String id,
            @RequestBody String body
    ) {
        String featureId = resolvePipeFeatureId(id);
        if (featureId == null) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_json"));
        }

        JsonNode propertiesNode = root.get("properties");
        if (propertiesNode == null || !propertiesNode.isObject()) {
            return ResponseEntity.badRequest().body(errorNode("properties_required"));
        }

        JsonNode visibleNode = root.get("visible");
        Boolean visible = null;
        if (visibleNode != null && !visibleNode.isNull()) {
            if (!visibleNode.isBoolean()) {
                return ResponseEntity.badRequest().body(errorNode("visible_required"));
            }
            visible = visibleNode.asBoolean();
        }

        String updatedBy = parseUpdatedBy(root);
        JsonNode before = queryFeatureGeoJson(featureId);
        boolean targetVisible = visible != null ? visible : queryFeatureVisible(featureId);

        int updated;
        try {
            updated = jdbcTemplate.update(
                    "UPDATE geo_features SET properties = ?::jsonb, visible = ? WHERE id = ?",
                    propertiesNode.toString(),
                    targetVisible,
                    featureId
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_properties"));
        }
        if (updated == 0) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        try {
            syncSegmentAttributesFromFeature(featureId);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(errorNode("segment_sync_failed"));
        }

        JsonNode after = queryFeatureGeoJson(featureId);
        insertAuditLog(featureId, "properties_update", updatedBy, before, after);

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("id", featureId);
        ok.put("action", "properties_update");
        return ResponseEntity.ok(ok);
    }

    @GetMapping(value = "/audit/{featureId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode listAuditLogs(
            @PathVariable("featureId") String featureId,
            @RequestParam(name = "limit", required = false, defaultValue = "30") int limit
    ) {
        int finalLimit = Math.max(1, Math.min(limit, 200));
        String sql = "SELECT id, feature_id, action, changed_by, before_payload, after_payload, changed_at " +
                "FROM edit_audit_log WHERE feature_id = ? ORDER BY changed_at DESC LIMIT ?";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, featureId, finalLimit);
        ObjectNode root = objectMapper.createObjectNode();
        root.put("featureId", featureId);
        ArrayNode list = objectMapper.createArrayNode();
        root.set("list", list);

        for (Map<String, Object> row : rows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("id", String.valueOf(row.get("id")));
            item.put("featureId", String.valueOf(row.get("feature_id")));
            item.put("action", String.valueOf(row.get("action")));
            item.put("changedBy", String.valueOf(row.get("changed_by")));
            item.put("changedAt", String.valueOf(row.get("changed_at")));
            item.set("before", parseJsonAny(row.get("before_payload")));
            item.set("after", parseJsonAny(row.get("after_payload")));
            list.add(item);
        }
        return root;
    }

    private JsonNode queryFeatureGeoJson(String id) {
        String sql = "SELECT jsonb_build_object(" +
                "'type','Feature'," +
                "'id', id," +
                "'properties', properties || jsonb_build_object('visible', visible)," +
                "'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ") AS feature " +
                "FROM geo_features WHERE id = ?";

        String json = jdbcTemplate.query(sql, ps -> ps.setString(1, id), rs -> {
            if (!rs.next()) return null;
            return rs.getString("feature");
        });
        if (json == null) return objectMapper.getNodeFactory().nullNode();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.getNodeFactory().nullNode();
        }
    }

    private ObjectNode querySegmentByFeature(String featureId) {
        String sql = "SELECT id, feature_id, from_node_id, to_node_id, diameter_mm, material, status, properties " +
                "FROM pipe_segments WHERE feature_id = ? OR id = ? LIMIT 1";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, featureId, featureId);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        return toSegmentNode(row);
    }

    private ArrayNode queryNodesByCandidates(Set<String> candidateIds) {
        ArrayNode nodes = objectMapper.createArrayNode();
        if (candidateIds.isEmpty()) return nodes;

        String placeholders = String.join(",", java.util.Collections.nCopies(candidateIds.size(), "?"));
        String sql = "SELECT id, feature_id, node_type, name, properties " +
                "FROM pipe_nodes WHERE id IN (" + placeholders + ") OR feature_id IN (" + placeholders + ")";
        List<Object> params = new ArrayList<>(candidateIds.size() * 2);
        params.addAll(candidateIds);
        params.addAll(candidateIds);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", String.valueOf(row.get("id")));
            node.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            node.put("nodeType", String.valueOf(row.get("node_type")));
            node.put("name", row.get("name") == null ? "" : String.valueOf(row.get("name")));
            node.set("properties", parseJsonObject(row.get("properties")));
            nodes.add(node);
        }
        return nodes;
    }

    private ArrayNode queryRelationsByCandidates(Set<String> candidateIds) {
        ArrayNode relations = objectMapper.createArrayNode();
        if (candidateIds.isEmpty()) return relations;

        String placeholders = String.join(",", java.util.Collections.nCopies(candidateIds.size(), "?"));
        String sql = "SELECT id, source_id, source_type, target_id, target_type, relation_type, properties " +
                "FROM asset_relations WHERE source_id IN (" + placeholders + ") OR target_id IN (" + placeholders + ")";
        List<Object> params = new ArrayList<>(candidateIds.size() * 2);
        params.addAll(candidateIds);
        params.addAll(candidateIds);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode relation = objectMapper.createObjectNode();
            relation.put("id", String.valueOf(row.get("id")));
            relation.put("sourceId", String.valueOf(row.get("source_id")));
            relation.put("sourceType", String.valueOf(row.get("source_type")));
            relation.put("targetId", String.valueOf(row.get("target_id")));
            relation.put("targetType", String.valueOf(row.get("target_type")));
            relation.put("relationType", String.valueOf(row.get("relation_type")));
            relation.set("properties", parseJsonObject(row.get("properties")));
            relations.add(relation);
        }
        return relations;
    }

    private ArrayNode queryLinkedBuildings(ArrayNode relations, String featureId) {
        Set<String> buildingIds = new LinkedHashSet<>();
        for (JsonNode relation : relations) {
            String sourceType = relation.path("sourceType").asText("").toLowerCase();
            String targetType = relation.path("targetType").asText("").toLowerCase();
            if ("building".equals(sourceType)) {
                buildingIds.add(relation.path("sourceId").asText(""));
            }
            if ("building".equals(targetType)) {
                buildingIds.add(relation.path("targetId").asText(""));
            }
        }

        if (buildingIds.isEmpty()) {
            return queryNearestBuildings(featureId);
        }
        return queryBuildingRows(buildingIds);
    }

    private ArrayNode queryNearestBuildings(String featureId) {
        ArrayNode linked = objectMapper.createArrayNode();
        String sql = "WITH src AS (" +
                "  SELECT geom FROM geo_features WHERE id = ?" +
                ") " +
                "SELECT g.id, COALESCE(g.properties->>'name', g.id) AS name, " +
                "       ROUND(ST_Distance(g.geom::geography, src.geom::geography)::numeric, 2) AS distance_m " +
                "FROM geo_features g, src " +
                "WHERE g.layer = 'buildings' " +
                "ORDER BY g.geom <-> src.geom " +
                "LIMIT 5";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, featureId);
        for (Map<String, Object> row : rows) {
            ObjectNode b = objectMapper.createObjectNode();
            b.put("id", String.valueOf(row.get("id")));
            b.put("name", String.valueOf(row.get("name")));
            Object dist = row.get("distance_m");
            b.put("distanceMeters", dist instanceof Number ? ((Number) dist).doubleValue() : 0.0);
            linked.add(b);
        }
        return linked;
    }

    private ArrayNode queryBuildingRows(Set<String> buildingIds) {
        ArrayNode linked = objectMapper.createArrayNode();
        if (buildingIds.isEmpty()) return linked;

        String placeholders = String.join(",", java.util.Collections.nCopies(buildingIds.size(), "?"));
        String sql = "SELECT id, COALESCE(properties->>'name', id) AS name " +
                "FROM geo_features WHERE id IN (" + placeholders + ")";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, buildingIds.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode b = objectMapper.createObjectNode();
            b.put("id", String.valueOf(row.get("id")));
            b.put("name", String.valueOf(row.get("name")));
            linked.add(b);
        }
        return linked;
    }

    private List<SegmentTopology> queryAllSegments() {
        String sql = "SELECT id, feature_id, from_node_id, to_node_id FROM pipe_segments";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new SegmentTopology(
                rs.getString("id"),
                rs.getString("feature_id"),
                rs.getString("from_node_id"),
                rs.getString("to_node_id")
        ));
    }

    private ObjectNode toSegmentNode(Map<String, Object> row) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", String.valueOf(row.get("id")));
        node.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
        node.put("fromNodeId", row.get("from_node_id") == null ? "" : String.valueOf(row.get("from_node_id")));
        node.put("toNodeId", row.get("to_node_id") == null ? "" : String.valueOf(row.get("to_node_id")));
        Object diameter = row.get("diameter_mm");
        if (diameter instanceof Number) {
            node.put("diameterMm", ((Number) diameter).doubleValue());
        } else {
            node.putNull("diameterMm");
        }
        node.put("material", row.get("material") == null ? "" : String.valueOf(row.get("material")));
        node.put("status", row.get("status") == null ? "" : String.valueOf(row.get("status")));
        node.set("properties", parseJsonObject(row.get("properties")));
        return node;
    }

    private String resolvePipeFeatureId(String idOrFeatureId) {
        if (idOrFeatureId == null || idOrFeatureId.isBlank()) return null;

        String featureId = jdbcTemplate.query(
                "SELECT id FROM geo_features WHERE id = ? AND layer = 'roads'",
                ps -> ps.setString(1, idOrFeatureId),
                rs -> rs.next() ? rs.getString("id") : null
        );
        if (featureId != null) return featureId;

        return jdbcTemplate.query(
                "SELECT feature_id FROM pipe_segments WHERE id = ?",
                ps -> ps.setString(1, idOrFeatureId),
                rs -> rs.next() ? rs.getString("feature_id") : null
        );
    }

    private boolean queryFeatureVisible(String featureId) {
        Boolean visible = jdbcTemplate.query(
                "SELECT visible FROM geo_features WHERE id = ?",
                ps -> ps.setString(1, featureId),
                rs -> rs.next() ? rs.getBoolean("visible") : null
        );
        return visible == null || visible;
    }

    private String parseUpdatedBy(JsonNode root) {
        JsonNode updatedByNode = root.get("updatedBy");
        if (updatedByNode != null && updatedByNode.isTextual()) {
            String v = updatedByNode.asText().trim();
            if (!v.isBlank()) return v;
        }
        return "system";
    }

    private void insertAuditLog(
            String featureId,
            String action,
            String changedBy,
            JsonNode before,
            JsonNode after
    ) {
        jdbcTemplate.update(
                "INSERT INTO edit_audit_log (feature_id, action, changed_by, before_payload, after_payload) " +
                        "VALUES (?, ?, ?, ?::jsonb, ?::jsonb)",
                featureId,
                action,
                changedBy,
                before == null ? "null" : before.toString(),
                after == null ? "null" : after.toString()
        );
    }

    private void syncTopologyForFeature(String featureId) {
        FeatureEndpoints endpoints = queryFeatureEndpoints(featureId);
        if (endpoints == null) {
            throw new IllegalStateException("line_geometry_required");
        }

        upsertPipeNode(endpoints.fromNodeId(), endpoints.startLon(), endpoints.startLat());
        upsertPipeNode(endpoints.toNodeId(), endpoints.endLon(), endpoints.endLat());
        upsertPipeSegment(featureId, endpoints.fromNodeId(), endpoints.toNodeId());
    }

    private void syncSegmentAttributesFromFeature(String featureId) {
        String sql = "INSERT INTO pipe_segments (" +
                "id, feature_id, from_node_id, to_node_id, diameter_mm, material, status, properties" +
                ") " +
                "SELECT " +
                "COALESCE((SELECT s.id FROM pipe_segments s WHERE s.feature_id = g.id LIMIT 1), " +
                "'seg_' || substr(md5(g.id), 1, 16)), " +
                "g.id, " +
                "(SELECT s.from_node_id FROM pipe_segments s WHERE s.feature_id = g.id LIMIT 1), " +
                "(SELECT s.to_node_id FROM pipe_segments s WHERE s.feature_id = g.id LIMIT 1), " +
                "NULLIF(regexp_replace(COALESCE(g.properties->>'diameter_mm', g.properties->>'diameter', ''), '[^0-9.]', '', 'g'), '')::numeric, " +
                "NULLIF(COALESCE(g.properties->>'material', ''), ''), " +
                "COALESCE(NULLIF(g.properties->>'status', ''), 'normal'), " +
                "jsonb_build_object('autoSynced', true, 'syncSource', 'properties_update') " +
                "FROM geo_features g WHERE g.id = ? AND g.layer = 'roads' " +
                "ON CONFLICT (feature_id) DO UPDATE " +
                "SET diameter_mm = COALESCE(EXCLUDED.diameter_mm, pipe_segments.diameter_mm), " +
                "material = COALESCE(EXCLUDED.material, pipe_segments.material), " +
                "status = COALESCE(EXCLUDED.status, pipe_segments.status), " +
                "properties = pipe_segments.properties || EXCLUDED.properties, " +
                "updated_at = now()";
        int changed = jdbcTemplate.update(sql, featureId);
        if (changed == 0) {
            throw new IllegalStateException("feature_not_found");
        }
    }

    private FeatureEndpoints queryFeatureEndpoints(String featureId) {
        String sql = "WITH feature_line AS (" +
                "  SELECT id AS feature_id, " +
                "         CASE " +
                "           WHEN GeometryType(geom) = 'LINESTRING' THEN geom " +
                "           WHEN GeometryType(geom) = 'MULTILINESTRING' THEN ST_LineMerge(geom) " +
                "           ELSE NULL " +
                "         END AS merged_geom " +
                "  FROM geo_features " +
                "  WHERE id = ? AND layer = 'roads'" +
                "), line_ready AS (" +
                "  SELECT feature_id, " +
                "         CASE " +
                "           WHEN merged_geom IS NULL THEN NULL " +
                "           WHEN GeometryType(merged_geom) = 'LINESTRING' THEN merged_geom " +
                "           WHEN GeometryType(merged_geom) = 'MULTILINESTRING' THEN ST_GeometryN(merged_geom, 1) " +
                "           ELSE NULL " +
                "         END AS line_geom " +
                "  FROM feature_line" +
                "), endpoints AS (" +
                "  SELECT feature_id, line_geom, " +
                "         'node_' || substr(md5(concat(round(ST_X(ST_StartPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_StartPoint(line_geom))::numeric, 6))), 1, 16) AS from_node_id, " +
                "         'node_' || substr(md5(concat(round(ST_X(ST_EndPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_EndPoint(line_geom))::numeric, 6))), 1, 16) AS to_node_id, " +
                "         round(ST_X(ST_StartPoint(line_geom))::numeric, 8) AS start_lon, " +
                "         round(ST_Y(ST_StartPoint(line_geom))::numeric, 8) AS start_lat, " +
                "         round(ST_X(ST_EndPoint(line_geom))::numeric, 8) AS end_lon, " +
                "         round(ST_Y(ST_EndPoint(line_geom))::numeric, 8) AS end_lat " +
                "  FROM line_ready WHERE line_geom IS NOT NULL" +
                ") " +
                "SELECT from_node_id, to_node_id, start_lon, start_lat, end_lon, end_lat FROM endpoints LIMIT 1";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, featureId);
        if (rows.isEmpty()) return null;

        Map<String, Object> row = rows.get(0);
        String fromNodeId = String.valueOf(row.get("from_node_id"));
        String toNodeId = String.valueOf(row.get("to_node_id"));
        double startLon = toDoubleOrThrow(row.get("start_lon"), "start_lon_missing");
        double startLat = toDoubleOrThrow(row.get("start_lat"), "start_lat_missing");
        double endLon = toDoubleOrThrow(row.get("end_lon"), "end_lon_missing");
        double endLat = toDoubleOrThrow(row.get("end_lat"), "end_lat_missing");
        return new FeatureEndpoints(fromNodeId, toNodeId, startLon, startLat, endLon, endLat);
    }

    private void upsertPipeNode(String nodeId, double lon, double lat) {
        ObjectNode properties = objectMapper.createObjectNode();
        properties.put("lon", roundCoordinate(lon, 8));
        properties.put("lat", roundCoordinate(lat, 8));
        properties.put("autoSynced", true);

        jdbcTemplate.update(
                "INSERT INTO pipe_nodes (id, feature_id, node_type, name, properties) " +
                        "VALUES (?, NULL, 'junction', ?, ?::jsonb) " +
                        "ON CONFLICT (id) DO UPDATE " +
                        "SET properties = pipe_nodes.properties || EXCLUDED.properties, " +
                        "updated_at = now()",
                nodeId,
                nodeId,
                properties.toString()
        );
    }

    private void upsertPipeSegment(String featureId, String fromNodeId, String toNodeId) {
        String sql = "INSERT INTO pipe_segments (" +
                "id, feature_id, from_node_id, to_node_id, diameter_mm, material, status, properties" +
                ") " +
                "SELECT " +
                "'seg_' || substr(md5(g.id), 1, 16), " +
                "g.id, ?, ?, " +
                "NULLIF(regexp_replace(COALESCE(g.properties->>'diameter_mm', g.properties->>'diameter', ''), '[^0-9.]', '', 'g'), '')::numeric, " +
                "NULLIF(COALESCE(g.properties->>'material', ''), ''), " +
                "COALESCE(NULLIF(g.properties->>'status', ''), 'normal'), " +
                "jsonb_build_object('autoSynced', true, 'syncSource', 'geometry_update') " +
                "FROM geo_features g WHERE g.id = ? AND g.layer = 'roads' " +
                "ON CONFLICT (feature_id) DO UPDATE " +
                "SET from_node_id = EXCLUDED.from_node_id, " +
                "to_node_id = EXCLUDED.to_node_id, " +
                "diameter_mm = COALESCE(EXCLUDED.diameter_mm, pipe_segments.diameter_mm), " +
                "material = COALESCE(EXCLUDED.material, pipe_segments.material), " +
                "status = COALESCE(EXCLUDED.status, pipe_segments.status), " +
                "properties = pipe_segments.properties || EXCLUDED.properties, " +
                "updated_at = now()";
        int changed = jdbcTemplate.update(sql, fromNodeId, toNodeId, featureId);
        if (changed == 0) {
            throw new IllegalStateException("feature_not_found");
        }
    }

    private double toDoubleOrThrow(Object raw, String code) {
        if (raw instanceof Number n) return n.doubleValue();
        if (raw != null) {
            try {
                return Double.parseDouble(String.valueOf(raw));
            } catch (NumberFormatException ignored) {
                // handled below
            }
        }
        throw new IllegalStateException(code);
    }

    private double roundCoordinate(double value, int scale) {
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).doubleValue();
    }

    private ObjectNode errorNode(String code) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("error", code);
        return node;
    }

    private JsonNode parseJsonAny(Object raw) {
        if (raw == null) return objectMapper.getNodeFactory().nullNode();
        try {
            return objectMapper.readTree(String.valueOf(raw));
        } catch (Exception e) {
            return objectMapper.getNodeFactory().nullNode();
        }
    }

    private JsonNode parseJsonObject(Object raw) {
        if (raw == null) return objectMapper.createObjectNode();
        try {
            JsonNode n = objectMapper.readTree(String.valueOf(raw));
            if (n.isObject()) return n;
            return objectMapper.createObjectNode();
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private record SegmentTopology(
            String id,
            String featureId,
            String fromNodeId,
            String toNodeId
    ) {}

    private record FeatureEndpoints(
            String fromNodeId,
            String toNodeId,
            double startLon,
            double startLat,
            double endLon,
            double endLat
    ) {}
}
