package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class GeoFeatureController {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public GeoFeatureController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = "/features", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode listFeatures(
            @RequestParam(name = "bbox", required = false) String bbox,
            @RequestParam(name = "layers", required = false) String layers,
            @RequestParam(name = "limit", required = false, defaultValue = "2000") int limit,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "offset", required = false) Integer offset,
            @RequestParam(name = "visible", required = false) Boolean visible
    ) {
        // bbox: minLon,minLat,maxLon,maxLat (EPSG:4326)
        String where = "WHERE 1=1";
        java.util.ArrayList<Object> params = new java.util.ArrayList<>();

        if (layers != null && !layers.isBlank()) {
            List<String> layerList = List.of(layers.split(",")).stream()
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .map(GeoFeatureController::normalizeLayerName)
                    .toList();

            if (!layerList.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                sb.append(" AND layer IN (");
                for (int i = 0; i < layerList.size(); i++) {
                    if (i > 0) sb.append(",");
                    sb.append("?");
                    params.add(layerList.get(i));
                }
                sb.append(")");
                where += sb;
            }
        }

        if (bbox != null && !bbox.isBlank()) {
            double[] b = parseBbox(bbox);
            where += " AND geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)";
            params.add(b[0]);
            params.add(b[1]);
            params.add(b[2]);
            params.add(b[3]);
        }

        if (visible != null) {
            where += " AND visible = ?";
            params.add(visible);
        }

        int safeLimit = Math.max(1, Math.min(limit, 5000));
        long finalOffset = 0L;
        if (offset != null) {
            finalOffset = Math.max(0L, offset.longValue());
        } else if (page != null && page > 1) {
            long computed = (page.longValue() - 1L) * safeLimit;
            finalOffset = Math.max(0L, Math.min(computed, Integer.MAX_VALUE));
        }

        params.add(safeLimit);
        params.add(finalOffset);
        Object[] finalParams = params.toArray();

        String sql = "SELECT jsonb_build_object(" +
                "'type','FeatureCollection'," +
                "'features', COALESCE(jsonb_agg(jsonb_build_object(" +
                "  'type','Feature'," +
                "  'id', id," +
                "  'properties', properties || jsonb_build_object('visible', visible)," +
                "  'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ")),'[]'::jsonb)" +
                ") AS fc " +
                "FROM (SELECT id, layer, geom, properties, visible FROM geo_features " + where +
                " ORDER BY id LIMIT ? OFFSET ?) t";

        String json = jdbcTemplate.queryForObject(sql, finalParams, String.class);
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize FeatureCollection", e);
        }
    }

    @GetMapping(value = "/features/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode getFeature(@PathVariable("id") String id) {
        String sql = "SELECT jsonb_build_object(" +
                "'type','Feature'," +
                "'id', id," +
                "'properties', properties || jsonb_build_object('visible', visible)," +
                "'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ") AS f " +
                "FROM geo_features WHERE id = ?";

        String json = jdbcTemplate.query(sql, ps -> ps.setString(1, id), rs -> {
            if (!rs.next()) return null;
            return rs.getString("f");
        });

        if (json == null) {
            try {
                return objectMapper.readTree("{\"error\":\"not_found\"}");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Feature", e);
        }
    }

    @PostMapping(value = "/features", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> createFeature(@RequestBody String body) {
        FeaturePayload payload;
        try {
            payload = parseFeaturePayload(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorNode(e.getMessage()));
        }

        try {
            jdbcTemplate.update(
                    "INSERT INTO geo_features (id, layer, geom, properties, visible) VALUES (?, ?, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), ?::jsonb, ?)",
                    payload.id(),
                    payload.layer(),
                    payload.geometryJson(),
                    payload.propertiesJson(),
                    payload.visible()
            );
        } catch (DuplicateKeyException e) {
            return ResponseEntity.status(409).body(errorNode("id_exists"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_feature"));
        }

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("id", payload.id());
        return ResponseEntity.status(201).body(ok);
    }

    @PutMapping(value = "/features", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> updateFeature(@RequestBody String body) {
        FeaturePayload payload;
        try {
            payload = parseFeaturePayload(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorNode(e.getMessage()));
        }

        int updated;
        try {
            updated = jdbcTemplate.update(
                    "UPDATE geo_features SET layer = ?, geom = ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), properties = ?::jsonb, visible = ? WHERE id = ?",
                    payload.layer(),
                    payload.geometryJson(),
                    payload.propertiesJson(),
                    payload.visible(),
                    payload.id()
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorNode("invalid_feature"));
        }

        if (updated == 0) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("id", payload.id());
        return ResponseEntity.ok(ok);
    }

    @DeleteMapping(value = "/features", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> deleteFeature(@RequestParam("id") String id) {
        if (id == null || id.isBlank()) {
            return ResponseEntity.badRequest().body(errorNode("id_required"));
        }

        int deleted = jdbcTemplate.update("DELETE FROM geo_features WHERE id = ?", id);
        if (deleted == 0) {
            return ResponseEntity.status(404).body(errorNode("not_found"));
        }

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("id", id);
        return ResponseEntity.ok(ok);
    }

    @PutMapping(value = "/features/visibility", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> setVisibilityByBody(@RequestBody String body) {
        String id;
        boolean v;

        try {
            JsonNode n = objectMapper.readTree(body);

            JsonNode idNode = n.get("id");
            if (idNode == null || !idNode.isTextual() || idNode.asText().isBlank()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"id_required\"}"));
            }
            id = idNode.asText();

            JsonNode vv = n.get("visible");
            if (vv == null || !vv.isBoolean()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"visible_required\"}"));
            }
            v = vv.asBoolean();
        } catch (Exception e) {
            try {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"invalid_json\"}"));
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }

        int updated = jdbcTemplate.update("UPDATE geo_features SET visible = ? WHERE id = ?", v, id);
        if (updated == 0) {
            try {
                return ResponseEntity.status(404).body(objectMapper.readTree("{\"error\":\"not_found\"}"));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return ResponseEntity.ok(objectMapper.readTree("{\"ok\":true}"));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // Backward compatible endpoint (NOTE: ids like "relation/123" will trigger %2F issues in some servers)
    @PutMapping(value = "/features/{id}/visibility", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> setVisibilityLegacy(
            @PathVariable("id") String id,
            @RequestBody String body
    ) {
        boolean v;
        try {
            JsonNode n = objectMapper.readTree(body);
            JsonNode vv = n.get("visible");
            if (vv == null || !vv.isBoolean()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"visible_required\"}"));
            }
            v = vv.asBoolean();
        } catch (Exception e) {
            try {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"invalid_json\"}"));
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }

        int updated = jdbcTemplate.update("UPDATE geo_features SET visible = ? WHERE id = ?", v, id);
        if (updated == 0) {
            try {
                return ResponseEntity.status(404).body(objectMapper.readTree("{\"error\":\"not_found\"}"));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return ResponseEntity.ok(objectMapper.readTree("{\"ok\":true}"));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static double[] parseBbox(String bbox) {
        String[] parts = bbox.split(",");
        if (parts.length != 4) {
            throw new IllegalArgumentException("bbox must be minLon,minLat,maxLon,maxLat");
        }
        return new double[] {
                Double.parseDouble(parts[0].trim()),
                Double.parseDouble(parts[1].trim()),
                Double.parseDouble(parts[2].trim()),
                Double.parseDouble(parts[3].trim())
        };
    }

    private static String normalizeLayerName(String layer) {
        if ("pipes".equalsIgnoreCase(layer)) {
            return "roads";
        }
        return layer;
    }

    private FeaturePayload parseFeaturePayload(String body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid_json");
        }

        JsonNode idNode = root.get("id");
        if (idNode == null || !idNode.isTextual() || idNode.asText().isBlank()) {
            throw new IllegalArgumentException("id_required");
        }
        String id = idNode.asText().trim();

        JsonNode layerNode = root.get("layer");
        if (layerNode == null || !layerNode.isTextual() || layerNode.asText().isBlank()) {
            throw new IllegalArgumentException("layer_required");
        }
        String layer = normalizeLayerName(layerNode.asText().trim());

        JsonNode geometryNode = root.get("geometry");
        if (geometryNode == null || !geometryNode.isObject()) {
            throw new IllegalArgumentException("geometry_required");
        }

        JsonNode propertiesNode = root.get("properties");
        ObjectNode propertiesObject;
        if (propertiesNode == null || propertiesNode.isNull()) {
            propertiesObject = objectMapper.createObjectNode();
        } else if (propertiesNode.isObject()) {
            propertiesObject = ((ObjectNode) propertiesNode).deepCopy();
        } else {
            throw new IllegalArgumentException("properties_required");
        }
        propertiesObject.remove("visible");

        JsonNode visibleNode = root.get("visible");
        boolean visible = true;
        if (visibleNode != null && !visibleNode.isNull()) {
            if (!visibleNode.isBoolean()) {
                throw new IllegalArgumentException("visible_required");
            }
            visible = visibleNode.asBoolean();
        }

        return new FeaturePayload(id, layer, geometryNode.toString(), propertiesObject.toString(), visible);
    }

    private ObjectNode errorNode(String code) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("error", code);
        return node;
    }

    private record FeaturePayload(
            String id,
            String layer,
            String geometryJson,
            String propertiesJson,
            boolean visible
    ) {}
}
