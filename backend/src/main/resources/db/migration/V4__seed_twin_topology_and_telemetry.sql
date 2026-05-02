-- Seed initial twin topology, relations and telemetry from existing geo_features data.

DELETE FROM asset_relations a
USING asset_relations b
WHERE a.id > b.id
  AND a.source_id = b.source_id
  AND a.source_type = b.source_type
  AND a.target_id = b.target_id
  AND a.target_type = b.target_type
  AND a.relation_type = b.relation_type;

CREATE UNIQUE INDEX IF NOT EXISTS asset_relations_unique_idx
ON asset_relations(source_id, source_type, target_id, target_type, relation_type);

WITH road_features AS (
    SELECT
        id AS feature_id,
        CASE
            WHEN GeometryType(geom) = 'LINESTRING' THEN geom
            WHEN GeometryType(geom) = 'MULTILINESTRING' THEN ST_LineMerge(geom)
            ELSE NULL
        END AS merged_geom,
        properties
    FROM geo_features
    WHERE layer = 'roads'
),
line_features AS (
    SELECT
        feature_id,
        CASE
            WHEN merged_geom IS NULL THEN NULL
            WHEN GeometryType(merged_geom) = 'LINESTRING' THEN merged_geom
            WHEN GeometryType(merged_geom) = 'MULTILINESTRING' THEN ST_GeometryN(merged_geom, 1)
            ELSE NULL
        END AS line_geom,
        properties
    FROM road_features
),
segment_nodes AS (
    SELECT
        feature_id,
        line_geom,
        'node_' || substr(md5(
            concat(round(ST_X(ST_StartPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_StartPoint(line_geom))::numeric, 6))
        ), 1, 16) AS from_node_id,
        'node_' || substr(md5(
            concat(round(ST_X(ST_EndPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_EndPoint(line_geom))::numeric, 6))
        ), 1, 16) AS to_node_id,
        ST_StartPoint(line_geom) AS start_pt,
        ST_EndPoint(line_geom) AS end_pt,
        properties
    FROM line_features
    WHERE line_geom IS NOT NULL
)
INSERT INTO pipe_nodes (id, feature_id, node_type, name, properties)
SELECT DISTINCT
    node_id,
    NULL,
    'junction',
    node_id,
    jsonb_build_object(
        'lon', round(ST_X(node_pt)::numeric, 8),
        'lat', round(ST_Y(node_pt)::numeric, 8),
        'seeded', true
    )
FROM (
    SELECT from_node_id AS node_id, start_pt AS node_pt FROM segment_nodes
    UNION ALL
    SELECT to_node_id AS node_id, end_pt AS node_pt FROM segment_nodes
) n
ON CONFLICT (id) DO UPDATE
SET properties = pipe_nodes.properties || EXCLUDED.properties,
    updated_at = now();

WITH road_features AS (
    SELECT
        id AS feature_id,
        CASE
            WHEN GeometryType(geom) = 'LINESTRING' THEN geom
            WHEN GeometryType(geom) = 'MULTILINESTRING' THEN ST_LineMerge(geom)
            ELSE NULL
        END AS merged_geom,
        properties
    FROM geo_features
    WHERE layer = 'roads'
),
line_features AS (
    SELECT
        feature_id,
        CASE
            WHEN merged_geom IS NULL THEN NULL
            WHEN GeometryType(merged_geom) = 'LINESTRING' THEN merged_geom
            WHEN GeometryType(merged_geom) = 'MULTILINESTRING' THEN ST_GeometryN(merged_geom, 1)
            ELSE NULL
        END AS line_geom,
        properties
    FROM road_features
),
segment_nodes AS (
    SELECT
        feature_id,
        line_geom,
        'node_' || substr(md5(
            concat(round(ST_X(ST_StartPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_StartPoint(line_geom))::numeric, 6))
        ), 1, 16) AS from_node_id,
        'node_' || substr(md5(
            concat(round(ST_X(ST_EndPoint(line_geom))::numeric, 6), '_', round(ST_Y(ST_EndPoint(line_geom))::numeric, 6))
        ), 1, 16) AS to_node_id,
        properties
    FROM line_features
    WHERE line_geom IS NOT NULL
)
INSERT INTO pipe_segments (
    id,
    feature_id,
    from_node_id,
    to_node_id,
    diameter_mm,
    material,
    status,
    properties
)
SELECT
    'seg_' || substr(md5(feature_id), 1, 16) AS id,
    feature_id,
    from_node_id,
    to_node_id,
    NULLIF(
        regexp_replace(
            COALESCE(properties->>'diameter_mm', properties->>'diameter', ''),
            '[^0-9.]',
            '',
            'g'
        ),
        ''
    )::numeric AS diameter_mm,
    NULLIF(COALESCE(properties->>'material', ''), '') AS material,
    COALESCE(NULLIF(properties->>'status', ''), 'normal') AS status,
    jsonb_build_object('seeded', true)
FROM segment_nodes
ON CONFLICT (feature_id) DO UPDATE
SET from_node_id = EXCLUDED.from_node_id,
    to_node_id = EXCLUDED.to_node_id,
    diameter_mm = COALESCE(EXCLUDED.diameter_mm, pipe_segments.diameter_mm),
    material = COALESCE(EXCLUDED.material, pipe_segments.material),
    status = COALESCE(EXCLUDED.status, pipe_segments.status),
    properties = pipe_segments.properties || EXCLUDED.properties,
    updated_at = now();

WITH segment_features AS (
    SELECT
        s.id AS segment_id,
        s.feature_id,
        g.geom AS segment_geom
    FROM pipe_segments s
    JOIN geo_features g ON g.id = s.feature_id
    WHERE s.feature_id IS NOT NULL
),
nearest_building AS (
    SELECT
        sf.feature_id,
        b.id AS building_id,
        ST_Distance(sf.segment_geom::geography, b.geom::geography) AS distance_m,
        row_number() OVER (
            PARTITION BY sf.feature_id
            ORDER BY sf.segment_geom <-> b.geom
        ) AS rn
    FROM segment_features sf
    JOIN geo_features b ON b.layer = 'buildings'
)
INSERT INTO asset_relations (
    source_id,
    source_type,
    target_id,
    target_type,
    relation_type,
    properties
)
SELECT
    feature_id,
    'pipe',
    building_id,
    'building',
    'serves',
    jsonb_build_object('distanceMeters', round(distance_m::numeric, 2), 'seeded', true)
FROM nearest_building
WHERE rn = 1
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(feature_id || '_pressure'), 1, 12),
    feature_id,
    'pressure',
    round((2.0 + ((abs(hashtextextended(feature_id, 11)) % 260)::numeric / 100.0)), 2),
    'bar',
    now(),
    'good',
    'seed'
FROM pipe_segments
WHERE feature_id IS NOT NULL
ON CONFLICT (point_id, metric) DO UPDATE
SET value = EXCLUDED.value,
    sampled_at = EXCLUDED.sampled_at,
    quality = EXCLUDED.quality,
    source = EXCLUDED.source;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(feature_id || '_flow'), 1, 12),
    feature_id,
    'flow',
    round((20.0 + ((abs(hashtextextended(feature_id, 17)) % 5000)::numeric / 10.0)), 1),
    'm3/h',
    now(),
    'good',
    'seed'
FROM pipe_segments
WHERE feature_id IS NOT NULL
ON CONFLICT (point_id, metric) DO UPDATE
SET value = EXCLUDED.value,
    sampled_at = EXCLUDED.sampled_at,
    quality = EXCLUDED.quality,
    source = EXCLUDED.source;
