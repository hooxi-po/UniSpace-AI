package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
        ArrayNode linkedBuildings = queryLinkedBuildings(relations, featureId);
        root.set("linkedBuildings", linkedBuildings);
        ArrayNode valves = queryValves(featureId, segment, nodes);
        root.set("valves", valves);
        root.set("impactedRooms", queryImpactedRooms(linkedBuildings));
        root.set("equipments", queryEquipments(featureId, nodes, linkedBuildings, valves));
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

    private ArrayNode queryImpactedRooms(ArrayNode linkedBuildings) {
        ArrayNode impactedRooms = objectMapper.createArrayNode();
        Set<String> buildingIds = extractBuildingIds(linkedBuildings);
        if (buildingIds.isEmpty()) return impactedRooms;

        String placeholders = String.join(",", java.util.Collections.nCopies(buildingIds.size(), "?"));
        String sql = "SELECT r.id, r.building_id, r.floor_id, r.room_no, COALESCE(r.room_name, '') AS room_name, " +
                "       COALESCE(r.room_type, '') AS room_type, COALESCE(r.status, '') AS status, r.area_m2, " +
                "       f.floor_no " +
                "FROM building_rooms r " +
                "LEFT JOIN building_floors f ON f.id = r.floor_id " +
                "WHERE r.building_id IN (" + placeholders + ") " +
                "ORDER BY r.building_id, f.floor_no NULLS LAST, r.room_no " +
                "LIMIT 300";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, buildingIds.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode room = objectMapper.createObjectNode();
            room.put("id", String.valueOf(row.get("id")));
            room.put("buildingId", String.valueOf(row.get("building_id")));
            room.put("floorId", row.get("floor_id") == null ? "" : String.valueOf(row.get("floor_id")));
            Object floorNo = row.get("floor_no");
            if (floorNo instanceof Number number) room.put("floorNo", number.intValue());
            else room.putNull("floorNo");
            room.put("roomNo", String.valueOf(row.get("room_no")));
            room.put("roomName", String.valueOf(row.get("room_name")));
            room.put("roomType", String.valueOf(row.get("room_type")));
            room.put("status", String.valueOf(row.get("status")));
            Object area = row.get("area_m2");
            if (area instanceof Number number) room.put("areaM2", number.doubleValue());
            else room.putNull("areaM2");
            impactedRooms.add(room);
        }

        if (!impactedRooms.isEmpty()) return impactedRooms;

        // Keep response meaningful even before room asset data is fully populated.
        for (String buildingId : buildingIds) {
            ObjectNode room = objectMapper.createObjectNode();
            room.put("id", "room_" + buildingId + "_001");
            room.put("buildingId", buildingId);
            room.put("floorId", "");
            room.put("floorNo", 1);
            room.put("roomNo", "001");
            room.put("roomName", "impacted-room-default");
            room.put("roomType", "unknown");
            room.put("status", "normal");
            room.putNull("areaM2");
            room.put("source", "fallback");
            impactedRooms.add(room);
        }
        return impactedRooms;
    }

    private ArrayNode queryValves(String featureId, ObjectNode segment, ArrayNode nodes) {
        ArrayNode valves = objectMapper.createArrayNode();
        Set<String> nodeIds = extractNodeIds(nodes);

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        String segmentId = segment == null ? null : segment.path("id").asText("");
        String segmentFeatureId = segment == null ? null : segment.path("featureId").asText("");
        if (segmentId != null && !segmentId.isBlank()) {
            conditions.add("segment_id = ?");
            params.add(segmentId);
        }
        if (segmentFeatureId != null && !segmentFeatureId.isBlank()) {
            conditions.add("feature_id = ?");
            params.add(segmentFeatureId);
        } else if (featureId != null && !featureId.isBlank()) {
            conditions.add("feature_id = ?");
            params.add(featureId);
        }
        if (!nodeIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(nodeIds.size(), "?"));
            conditions.add("node_id IN (" + placeholders + ")");
            params.addAll(nodeIds);
        }
        if (conditions.isEmpty()) return valves;

        String sql = "SELECT id, feature_id, node_id, segment_id, valve_type, status, control_mode, normal_state, properties " +
                "FROM pipe_valves WHERE " + String.join(" OR ", conditions) + " ORDER BY id LIMIT 200";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode valve = objectMapper.createObjectNode();
            valve.put("id", String.valueOf(row.get("id")));
            valve.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            valve.put("nodeId", row.get("node_id") == null ? "" : String.valueOf(row.get("node_id")));
            valve.put("segmentId", row.get("segment_id") == null ? "" : String.valueOf(row.get("segment_id")));
            valve.put("valveType", row.get("valve_type") == null ? "" : String.valueOf(row.get("valve_type")));
            valve.put("status", row.get("status") == null ? "" : String.valueOf(row.get("status")));
            valve.put("controlMode", row.get("control_mode") == null ? "" : String.valueOf(row.get("control_mode")));
            valve.put("normalState", row.get("normal_state") == null ? "" : String.valueOf(row.get("normal_state")));
            valve.set("properties", parseJsonObject(row.get("properties")));
            valves.add(valve);
        }
        return valves;
    }

    private ArrayNode queryEquipments(String featureId, ArrayNode nodes, ArrayNode linkedBuildings, ArrayNode valves) {
        ArrayNode equipments = objectMapper.createArrayNode();
        Set<String> nodeIds = extractNodeIds(nodes);

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (!nodeIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(nodeIds.size(), "?"));
            conditions.add("node_id IN (" + placeholders + ")");
            params.addAll(nodeIds);
        }
        if (featureId != null && !featureId.isBlank()) {
            conditions.add("feature_id = ?");
            params.add(featureId);
        }

        if (!conditions.isEmpty()) {
            String sql = "SELECT id, feature_id, node_id, COALESCE(name, id) AS name, station_type, status, " +
                    "       design_flow_m3h, design_head_m, power_kw, properties " +
                    "FROM pump_stations WHERE " + String.join(" OR ", conditions) + " ORDER BY id LIMIT 100";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
            for (Map<String, Object> row : rows) {
                ObjectNode equipment = objectMapper.createObjectNode();
                equipment.put("id", String.valueOf(row.get("id")));
                equipment.put("equipmentType", "pump_station");
                equipment.put("name", String.valueOf(row.get("name")));
                equipment.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
                equipment.put("nodeId", row.get("node_id") == null ? "" : String.valueOf(row.get("node_id")));
                equipment.put("stationType", row.get("station_type") == null ? "" : String.valueOf(row.get("station_type")));
                equipment.put("status", row.get("status") == null ? "" : String.valueOf(row.get("status")));
                Object flow = row.get("design_flow_m3h");
                if (flow instanceof Number number) equipment.put("designFlowM3h", number.doubleValue());
                else equipment.putNull("designFlowM3h");
                Object head = row.get("design_head_m");
                if (head instanceof Number number) equipment.put("designHeadM", number.doubleValue());
                else equipment.putNull("designHeadM");
                Object power = row.get("power_kw");
                if (power instanceof Number number) equipment.put("powerKw", number.doubleValue());
                else equipment.putNull("powerKw");
                equipment.set("properties", parseJsonObject(row.get("properties")));
                equipments.add(equipment);
            }
        }

        if (!equipments.isEmpty()) return equipments;

        for (JsonNode valve : valves) {
            ObjectNode equipment = objectMapper.createObjectNode();
            equipment.put("id", valve.path("id").asText(""));
            equipment.put("equipmentType", "valve");
            equipment.put("name", "valve-" + valve.path("id").asText(""));
            equipment.put("status", valve.path("status").asText("normal"));
            equipment.put("nodeId", valve.path("nodeId").asText(""));
            equipments.add(equipment);
        }
        if (!equipments.isEmpty()) return equipments;

        for (String buildingId : extractBuildingIds(linkedBuildings)) {
            ObjectNode equipment = objectMapper.createObjectNode();
            equipment.put("id", "eq_" + buildingId);
            equipment.put("equipmentType", "building_device");
            equipment.put("name", "building-critical-device");
            equipment.put("status", "unknown");
            equipment.put("buildingId", buildingId);
            equipments.add(equipment);
        }
        return equipments;
    }

    private Set<String> extractNodeIds(ArrayNode nodes) {
        Set<String> ids = new LinkedHashSet<>();
        for (JsonNode node : nodes) {
            String id = node.path("id").asText("");
            if (!id.isBlank()) ids.add(id);
        }
        return ids;
    }

    private Set<String> extractBuildingIds(ArrayNode linkedBuildings) {
        Set<String> ids = new LinkedHashSet<>();
        for (JsonNode building : linkedBuildings) {
            String id = building.path("id").asText("");
            if (!id.isBlank()) ids.add(id);
        }
        return ids;
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
}
