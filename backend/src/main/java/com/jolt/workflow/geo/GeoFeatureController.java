package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
            @RequestParam(name = "limit", required = false, defaultValue = "2000") int limit
    ) {
        // bbox: minLon,minLat,maxLon,maxLat (EPSG:4326)
        String where = "WHERE 1=1";
        String layerClause = "";
        Object[] params;

        if (layers != null && !layers.isBlank()) {
            List<String> layerList = List.of(layers.split(","));
            StringBuilder sb = new StringBuilder();
            sb.append(" AND layer IN (");
            for (int i = 0; i < layerList.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("?");
            }
            sb.append(")");
            layerClause = sb.toString();

            if (bbox != null && !bbox.isBlank()) {
                double[] b = parseBbox(bbox);
                params = new Object[layerList.size() + 4 + 1];
                int idx = 0;
                for (String l : layerList) params[idx++] = l.trim();
                params[idx++] = b[0];
                params[idx++] = b[1];
                params[idx++] = b[2];
                params[idx++] = b[3];
                params[idx] = limit;
                where += layerClause + " AND geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)";
            } else {
                params = new Object[layerList.size() + 1];
                int idx = 0;
                for (String l : layerList) params[idx++] = l.trim();
                params[idx] = limit;
                where += layerClause;
            }
        } else {
            if (bbox != null && !bbox.isBlank()) {
                double[] b = parseBbox(bbox);
                params = new Object[] { b[0], b[1], b[2], b[3], limit };
                where += " AND geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)";
            } else {
                params = new Object[] { limit };
            }
        }

        String sql = "SELECT jsonb_build_object(" +
                "'type','FeatureCollection'," +
                "'features', COALESCE(jsonb_agg(jsonb_build_object(" +
                "  'type','Feature'," +
                "  'id', id," +
                "  'properties', properties," +
                "  'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ")),'[]'::jsonb)" +
                ") AS fc " +
                "FROM (SELECT id, layer, geom, properties FROM geo_features " + where + " LIMIT ?) t";

        String json = jdbcTemplate.queryForObject(sql, params, String.class);
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
                "'properties', properties," +
                "'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ") AS f " +
                "FROM geo_features WHERE id = ?";

        String json = jdbcTemplate.query(sql, ps -> ps.setString(1, id), rs -> {
            if (!rs.next()) return null;
            return rs.getString("f");
        });

        if (json == null) {
            // 404 as JSON
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
}
