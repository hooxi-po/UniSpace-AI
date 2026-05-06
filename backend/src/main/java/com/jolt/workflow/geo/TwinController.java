package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
        if (segment == null) {
            segment = querySegmentByNode(featureId);
        }
        if (segment == null) root.putNull("segment");
        else root.set("segment", segment);

        Set<String> candidateAssetIds = new LinkedHashSet<>();
        candidateAssetIds.add(featureId);
        if (segment != null && segment.hasNonNull("id")) {
            candidateAssetIds.add(segment.get("id").asText());
            String segmentFeatureId = segment.path("featureId").asText("");
            if (!segmentFeatureId.isBlank()) {
                candidateAssetIds.add(segmentFeatureId);
            }
            String fromNodeId = segment.path("fromNodeId").asText("");
            if (!fromNodeId.isBlank()) {
                candidateAssetIds.add(fromNodeId);
            }
            String toNodeId = segment.path("toNodeId").asText("");
            if (!toNodeId.isBlank()) {
                candidateAssetIds.add(toNodeId);
            }
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
        ArrayNode manholes = queryManholes(featureId, segment, nodes);
        root.set("manholes", manholes);
        ArrayNode valves = queryValves(featureId, segment, nodes);
        root.set("valves", valves);
        ArrayNode pumpStations = queryPumpStations(featureId, nodes, linkedBuildings, valves);
        root.set("pumpStations", pumpStations);
        root.set("buildingFloors", queryBuildingFloors(linkedBuildings));
        root.set("impactedRooms", queryImpactedRooms(linkedBuildings));
        root.set("equipments", queryEquipments(featureId, nodes, linkedBuildings, valves, pumpStations));
        return root;
    }

    @GetMapping(value = "/trace", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode trace(
            @RequestParam("startId") String startId,
            @RequestParam(name = "direction", required = false, defaultValue = "down") String directionRaw
    ) {
        String direction = "up".equalsIgnoreCase(directionRaw) ? "up" : "down";
        List<SegmentTopology> segments = queryAllSegments();
        Map<String, SegmentTopology> segmentsById = new HashMap<>(segments.size());
        Map<String, SegmentTopology> segmentsByFeatureId = new HashMap<>(segments.size());
        Map<String, List<SegmentTopology>> downstreamIndex = new HashMap<>();
        Map<String, List<SegmentTopology>> upstreamIndex = new HashMap<>();
        for (SegmentTopology segment : segments) {
            segmentsById.put(segment.id(), segment);
            if (segment.featureId() != null && !segment.featureId().isBlank()) {
                segmentsByFeatureId.putIfAbsent(segment.featureId(), segment);
            }
            if (segment.fromNodeId() != null && !segment.fromNodeId().isBlank()) {
                downstreamIndex
                        .computeIfAbsent(segment.fromNodeId(), ignored -> new ArrayList<>())
                        .add(segment);
            }
            if (segment.toNodeId() != null && !segment.toNodeId().isBlank()) {
                upstreamIndex
                        .computeIfAbsent(segment.toNodeId(), ignored -> new ArrayList<>())
                        .add(segment);
            }
        }

        SegmentTopology startSegment = segmentsById.get(startId);
        if (startSegment == null) {
            startSegment = segmentsByFeatureId.get(startId);
        }

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

        Map<String, List<SegmentTopology>> adjacency = "up".equals(direction) ? upstreamIndex : downstreamIndex;
        while (!queue.isEmpty()) {
            SegmentTopology current = queue.removeFirst();
            String nodeId = "up".equals(direction) ? current.fromNodeId() : current.toNodeId();
            if (nodeId == null || nodeId.isBlank()) {
                continue;
            }
            List<SegmentTopology> candidates = adjacency.get(nodeId);
            if (candidates == null || candidates.isEmpty()) {
                continue;
            }
            for (SegmentTopology next : candidates) {
                if (!visitedSegmentIds.add(next.id())) continue;
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

    @GetMapping(value = "/nodes", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode listNodes(
            @RequestParam(name = "bbox", required = false) String bbox,
            @RequestParam(name = "limit", required = false, defaultValue = "1200") int limit,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "offset", required = false) Integer offset
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 4000));
        long finalOffset = 0L;
        if (offset != null) {
            finalOffset = Math.max(0L, offset.longValue());
        } else if (page != null && page > 1) {
            long computed = (page.longValue() - 1L) * safeLimit;
            finalOffset = Math.max(0L, Math.min(computed, Integer.MAX_VALUE));
        }

        String where = "WHERE (n.properties->>'lon') IS NOT NULL AND (n.properties->>'lat') IS NOT NULL";
        List<Object> params = new ArrayList<>();
        if (bbox != null && !bbox.isBlank()) {
            double[] b = parseBbox(bbox);
            where += " AND (n.properties->>'lon')::double precision BETWEEN ? AND ? " +
                    "AND (n.properties->>'lat')::double precision BETWEEN ? AND ?";
            params.add(b[0]);
            params.add(b[2]);
            params.add(b[1]);
            params.add(b[3]);
        }
        params.add(safeLimit);
        params.add(finalOffset);

        String sql = "WITH segment_refs AS (" +
                "  SELECT id AS segment_id, from_node_id AS node_id, status FROM pipe_segments WHERE from_node_id IS NOT NULL " +
                "  UNION ALL " +
                "  SELECT id AS segment_id, to_node_id AS node_id, status FROM pipe_segments WHERE to_node_id IS NOT NULL" +
                "), segment_stats AS (" +
                "  SELECT node_id, COUNT(DISTINCT segment_id) AS segment_count, CASE " +
                "    WHEN BOOL_OR(status = 'critical') THEN 'critical' " +
                "    WHEN BOOL_OR(status = 'warning') THEN 'warning' " +
                "    ELSE 'normal' END AS health_status " +
                "  FROM segment_refs GROUP BY node_id" +
                ") SELECT " +
                " n.id, n.feature_id, n.node_type, COALESCE(n.name, n.id) AS name, n.properties, " +
                " (n.properties->>'lon')::double precision AS lon, " +
                " (n.properties->>'lat')::double precision AS lat, " +
                " COALESCE(ss.segment_count, 0) AS segment_count, " +
                " COALESCE(ss.health_status, 'normal') AS health_status " +
                "FROM pipe_nodes n " +
                "LEFT JOIN segment_stats ss ON ss.node_id = n.id " +
                where + " ORDER BY n.id LIMIT ? OFFSET ?";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "FeatureCollection");
        ArrayNode features = objectMapper.createArrayNode();
        root.set("features", features);
        for (Map<String, Object> row : rows) {
            ObjectNode feature = objectMapper.createObjectNode();
            feature.put("type", "Feature");
            feature.put("id", String.valueOf(row.get("id")));

            ObjectNode properties = objectMapper.createObjectNode();
            properties.put("assetType", "pipe_node");
            properties.put("nodeId", String.valueOf(row.get("id")));
            properties.put("nodeType", row.get("node_type") == null ? "" : String.valueOf(row.get("node_type")));
            properties.put("name", String.valueOf(row.get("name")));
            properties.put("status", row.get("health_status") == null ? "normal" : String.valueOf(row.get("health_status")));
            Object segmentCount = row.get("segment_count");
            properties.put("segmentCount", segmentCount instanceof Number ? ((Number) segmentCount).intValue() : 0);
            properties.set("sourceProperties", parseJsonObject(row.get("properties")));
            feature.set("properties", properties);

            ObjectNode geometry = objectMapper.createObjectNode();
            geometry.put("type", "Point");
            ArrayNode coordinates = objectMapper.createArrayNode();
            coordinates.add(((Number) row.get("lon")).doubleValue());
            coordinates.add(((Number) row.get("lat")).doubleValue());
            geometry.set("coordinates", coordinates);
            feature.set("geometry", geometry);
            features.add(feature);
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

    private ObjectNode querySegmentByNode(String nodeId) {
        String sql = "SELECT id, feature_id, from_node_id, to_node_id, diameter_mm, material, status, properties " +
                "FROM pipe_segments WHERE from_node_id = ? OR to_node_id = ? ORDER BY updated_at DESC LIMIT 1";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, nodeId, nodeId);
        if (rows.isEmpty()) return null;
        return toSegmentNode(rows.get(0));
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

    private ArrayNode queryBuildingFloors(ArrayNode linkedBuildings) {
        ArrayNode floors = objectMapper.createArrayNode();
        Set<String> buildingIds = extractBuildingIds(linkedBuildings);
        if (buildingIds.isEmpty()) return floors;

        String placeholders = String.join(",", java.util.Collections.nCopies(buildingIds.size(), "?"));
        String sql = "SELECT f.id, f.building_id, f.floor_no, COALESCE(f.floor_name, 'F' || f.floor_no::text) AS floor_name, " +
                "       COALESCE(f.usage_type, '') AS usage_type, COUNT(r.id) AS room_count " +
                "FROM building_floors f " +
                "LEFT JOIN building_rooms r ON r.floor_id = f.id " +
                "WHERE f.building_id IN (" + placeholders + ") " +
                "GROUP BY f.id, f.building_id, f.floor_no, f.floor_name, f.usage_type " +
                "ORDER BY f.building_id, f.floor_no";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, buildingIds.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode floor = objectMapper.createObjectNode();
            floor.put("id", String.valueOf(row.get("id")));
            floor.put("buildingId", String.valueOf(row.get("building_id")));
            Object floorNo = row.get("floor_no");
            floor.put("floorNo", floorNo instanceof Number number ? number.intValue() : 0);
            floor.put("floorName", String.valueOf(row.get("floor_name")));
            floor.put("usageType", String.valueOf(row.get("usage_type")));
            Object roomCount = row.get("room_count");
            floor.put("roomCount", roomCount instanceof Number number ? number.intValue() : 0);
            floors.add(floor);
        }
        return floors;
    }

    private ArrayNode queryManholes(String featureId, ObjectNode segment, ArrayNode nodes) {
        ArrayNode manholes = objectMapper.createArrayNode();
        Set<String> nodeIds = extractNodeIds(nodes);

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (!nodeIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(nodeIds.size(), "?"));
            conditions.add("m.node_id IN (" + placeholders + ")");
            params.addAll(nodeIds);
        }
        String segmentFeatureId = segment == null ? null : segment.path("featureId").asText("");
        if (segmentFeatureId != null && !segmentFeatureId.isBlank()) {
            conditions.add("m.feature_id = ?");
            params.add(segmentFeatureId);
        } else if (featureId != null && !featureId.isBlank()) {
            conditions.add("m.feature_id = ?");
            params.add(featureId);
        }
        if (conditions.isEmpty()) return manholes;

        String sql = "SELECT m.id, m.feature_id, m.node_id, m.manhole_type, m.cover_status, m.gas_risk_level, m.properties, " +
                "       n.name, n.properties AS node_properties " +
                "FROM pipe_manholes m " +
                "LEFT JOIN pipe_nodes n ON n.id = m.node_id " +
                "WHERE " + String.join(" OR ", conditions) + " ORDER BY m.id LIMIT 200";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode manhole = objectMapper.createObjectNode();
            manhole.put("id", String.valueOf(row.get("id")));
            manhole.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            manhole.put("nodeId", row.get("node_id") == null ? "" : String.valueOf(row.get("node_id")));
            manhole.put("name", row.get("name") == null ? "" : String.valueOf(row.get("name")));
            manhole.put("manholeType", row.get("manhole_type") == null ? "" : String.valueOf(row.get("manhole_type")));
            manhole.put("coverStatus", row.get("cover_status") == null ? "" : String.valueOf(row.get("cover_status")));
            manhole.put("gasRiskLevel", row.get("gas_risk_level") == null ? "" : String.valueOf(row.get("gas_risk_level")));
            manhole.set("properties", parseJsonObject(row.get("properties")));
            manhole.set("nodeProperties", parseJsonObject(row.get("node_properties")));
            manholes.add(manhole);
        }
        return manholes;
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

    private ArrayNode queryPumpStations(String featureId, ArrayNode nodes, ArrayNode linkedBuildings, ArrayNode valves) {
        ArrayNode pumpStations = objectMapper.createArrayNode();
        Set<String> nodeIds = extractNodeIds(nodes);
        Set<String> buildingIds = extractBuildingIds(linkedBuildings);

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (!nodeIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(nodeIds.size(), "?"));
            conditions.add("p.node_id IN (" + placeholders + ")");
            params.addAll(nodeIds);
        }
        if (featureId != null && !featureId.isBlank()) {
            conditions.add("p.feature_id = ?");
            params.add(featureId);
        }
        if (!buildingIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(buildingIds.size(), "?"));
            conditions.add("EXISTS (SELECT 1 FROM asset_relations ar WHERE ar.source_id = p.id AND ar.source_type = 'pump_station' AND ar.target_id IN (" + placeholders + "))");
            params.addAll(buildingIds);
        }

        if (conditions.isEmpty()) return pumpStations;

        String sql = "SELECT p.id, p.feature_id, p.node_id, COALESCE(p.name, p.id) AS name, p.station_type, p.status, " +
                "       p.design_flow_m3h, p.design_head_m, p.power_kw, p.properties " +
                "FROM pump_stations p WHERE " + String.join(" OR ", conditions) + " ORDER BY p.id LIMIT 100";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        for (Map<String, Object> row : rows) {
            ObjectNode pump = objectMapper.createObjectNode();
            pump.put("id", String.valueOf(row.get("id")));
            pump.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            pump.put("nodeId", row.get("node_id") == null ? "" : String.valueOf(row.get("node_id")));
            pump.put("name", String.valueOf(row.get("name")));
            pump.put("stationType", row.get("station_type") == null ? "" : String.valueOf(row.get("station_type")));
            pump.put("status", row.get("status") == null ? "" : String.valueOf(row.get("status")));
            Object flow = row.get("design_flow_m3h");
            if (flow instanceof Number number) pump.put("designFlowM3h", number.doubleValue());
            else pump.putNull("designFlowM3h");
            Object head = row.get("design_head_m");
            if (head instanceof Number number) pump.put("designHeadM", number.doubleValue());
            else pump.putNull("designHeadM");
            Object power = row.get("power_kw");
            if (power instanceof Number number) pump.put("powerKw", number.doubleValue());
            else pump.putNull("powerKw");
            pump.set("properties", parseJsonObject(row.get("properties")));
            pumpStations.add(pump);
        }
        return pumpStations;
    }

    private ArrayNode queryEquipments(String featureId, ArrayNode nodes, ArrayNode linkedBuildings, ArrayNode valves, ArrayNode pumpStations) {
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

        for (JsonNode pumpStation : pumpStations) {
            ObjectNode equipment = objectMapper.createObjectNode();
            equipment.put("id", pumpStation.path("id").asText(""));
            equipment.put("equipmentType", "pump_station");
            equipment.put("name", pumpStation.path("name").asText(""));
            equipment.put("status", pumpStation.path("status").asText("normal"));
            equipment.put("nodeId", pumpStation.path("nodeId").asText(""));
            equipment.put("featureId", pumpStation.path("featureId").asText(""));
            equipments.add(equipment);
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

    private static double[] parseBbox(String bbox) {
        String[] parts = bbox.split(",");
        if (parts.length != 4) {
            throw new IllegalArgumentException("bbox must be minLon,minLat,maxLon,maxLat");
        }
        double minLon = Double.parseDouble(parts[0].trim());
        double minLat = Double.parseDouble(parts[1].trim());
        double maxLon = Double.parseDouble(parts[2].trim());
        double maxLat = Double.parseDouble(parts[3].trim());
        if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon > maxLon || minLat > maxLat) {
            throw new IllegalArgumentException("bbox out of range");
        }
        return new double[] {minLon, minLat, maxLon, maxLat};
    }

    private record SegmentTopology(
            String id,
            String featureId,
            String fromNodeId,
            String toNodeId
    ) {}
}
