BEGIN;

DROP TABLE IF EXISTS tmp_pipe_backfill;

CREATE TEMP TABLE tmp_pipe_backfill ON COMMIT DROP AS
WITH pipe_base AS (
    SELECT
        g.id AS feature_id,
        g.properties,
        row_number() OVER (ORDER BY g.id) AS rn,
        lower(
            concat_ws(
                ' ',
                COALESCE(g.properties->>'pipelineMedium', ''),
                COALESCE(g.properties->>'pipeLayer', ''),
                COALESCE(g.properties->>'medium', ''),
                COALESCE(g.properties->>'media', ''),
                COALESCE(g.properties->>'pipeType', ''),
                COALESCE(g.properties->>'name', '')
            )
        ) AS classifier_text,
        lower(COALESCE(g.properties->>'highway', '')) AS highway
    FROM geo_features g
    WHERE g.layer IN ('pipes', 'roads')
),
building_bindings AS (
    SELECT
        ar.source_id AS feature_id,
        array_agg(ar.target_id ORDER BY ar.target_id) AS building_ids,
        array_agg(
            COALESCE(NULLIF(b.properties->>'name', ''), ar.target_id)
            ORDER BY ar.target_id
        ) AS building_names
    FROM asset_relations ar
    LEFT JOIN geo_features b
        ON b.id = ar.target_id
       AND b.layer = 'buildings'
    WHERE ar.source_type = 'pipe'
      AND ar.target_type = 'building'
      AND ar.relation_type = 'serves'
    GROUP BY ar.source_id
),
classified AS (
    SELECT
        p.feature_id,
        p.rn,
        CASE
            WHEN p.classifier_text ~ '(sewage|sewer|污水|waste)' THEN 'sewage'
            WHEN p.classifier_text ~ '(drain|drainage|排水|rain|storm|雨水)' THEN 'drain'
            WHEN p.classifier_text ~ '(water|supply|给水|供水|主管)' THEN 'water'
            WHEN p.highway IN ('footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track') THEN 'drain'
            WHEN p.highway IN ('service', 'residential', 'living_street', 'tertiary', 'unclassified') THEN 'sewage'
            ELSE 'water'
        END AS pipeline_medium,
        b.building_ids,
        b.building_names
    FROM pipe_base p
    LEFT JOIN building_bindings b
        ON b.feature_id = p.feature_id
)
SELECT
    c.feature_id,
    c.rn,
    c.pipeline_medium,
    CASE c.pipeline_medium
        WHEN 'water' THEN '供水'
        WHEN 'drain' THEN '排水'
        ELSE '污水'
    END AS pipe_type_cn,
    CASE c.pipeline_medium
        WHEN 'water' THEN 250 + ((c.rn - 1) % 4) * 50
        WHEN 'drain' THEN 400 + ((c.rn - 1) % 3) * 100
        ELSE 300 + ((c.rn - 1) % 4) * 100
    END::numeric(10, 2) AS diameter_mm,
    CASE c.pipeline_medium
        WHEN 'water' THEN '球墨铸铁'
        WHEN 'drain' THEN 'HDPE'
        ELSE '钢筋混凝土'
    END AS material,
    CASE c.pipeline_medium
        WHEN 'water' THEN round((1.20 + ((c.rn - 1) % 5) * 0.18)::numeric, 2)
        WHEN 'drain' THEN round((1.55 + ((c.rn - 1) % 5) * 0.22)::numeric, 2)
        ELSE round((1.80 + ((c.rn - 1) % 5) * 0.24)::numeric, 2)
    END AS depth_m,
    CASE
        WHEN c.rn % 11 = 0 THEN 'critical'
        WHEN c.rn % 7 = 0 THEN 'warning'
        ELSE 'normal'
    END AS status_text,
    CASE
        WHEN c.rn % 11 = 0 THEN
            CASE c.pipeline_medium
                WHEN 'water' THEN 0.95
                WHEN 'drain' THEN 0.85
                ELSE 0.75
            END
        WHEN c.rn % 7 = 0 THEN
            CASE c.pipeline_medium
                WHEN 'water' THEN 1.15
                WHEN 'drain' THEN 1.05
                ELSE 0.95
            END
        ELSE
            CASE c.pipeline_medium
                WHEN 'water' THEN round((2.60 + ((c.rn - 1) % 4) * 0.28)::numeric, 2)
                WHEN 'drain' THEN round((1.55 + ((c.rn - 1) % 4) * 0.16)::numeric, 2)
                ELSE round((1.35 + ((c.rn - 1) % 4) * 0.14)::numeric, 2)
            END
    END::numeric(10, 2) AS pressure_value,
    CASE
        WHEN c.rn % 11 = 0 THEN 8
        WHEN c.rn % 7 = 0 THEN 18
        ELSE
            CASE c.pipeline_medium
                WHEN 'water' THEN 90 + ((c.rn - 1) % 5) * 18
                WHEN 'drain' THEN 65 + ((c.rn - 1) % 5) * 16
                ELSE 48 + ((c.rn - 1) % 5) * 12
            END
    END::numeric(10, 2) AS flow_value,
    round(
        CASE c.pipeline_medium
            WHEN 'water' THEN 0.08 + ((c.rn - 1) % 4) * 0.02
            WHEN 'drain' THEN 0.40 + ((c.rn - 1) % 4) * 0.08
            ELSE 0.65 + ((c.rn - 1) % 4) * 0.10
        END::numeric,
        2
    ) AS turbidity_value,
    round(
        CASE c.pipeline_medium
            WHEN 'water' THEN 0.20 + ((c.rn - 1) % 3) * 0.08
            WHEN 'drain' THEN 0.02
            ELSE 0.01
        END::numeric,
        2
    ) AS chlorine_value,
    to_char((DATE '2014-01-01' + (((c.rn - 1) * 160)::integer)), 'YYYY-MM-DD') AS install_date,
    to_char((DATE '2025-01-08' + (((c.rn - 1) * 9)::integer)), 'YYYY-MM-DD') AS last_maintain_date,
    COALESCE(c.building_ids[1], '') AS primary_building_id,
    COALESCE(c.building_names[1], '') AS primary_building_name,
    COALESCE(c.building_ids, ARRAY[]::text[]) AS building_ids,
    COALESCE(c.building_names, ARRAY[]::text[]) AS building_names
FROM classified c;

UPDATE geo_features g
SET properties = g.properties || jsonb_strip_nulls(
    jsonb_build_object(
        'name',
        CASE
            WHEN COALESCE(g.properties->>'name', '') = ''
                THEN t.pipe_type_cn || '管道-' || lpad(t.rn::text, 2, '0')
            ELSE NULL
        END,
        'pipelineMedium',
        CASE
            WHEN COALESCE(g.properties->>'pipelineMedium', '') = '' THEN t.pipeline_medium
            ELSE NULL
        END,
        'pipeLayer',
        CASE
            WHEN COALESCE(g.properties->>'pipeLayer', '') = '' THEN t.pipeline_medium
            ELSE NULL
        END,
        'medium',
        CASE
            WHEN COALESCE(g.properties->>'medium', '') = '' THEN t.pipeline_medium
            ELSE NULL
        END,
        'pipeType',
        CASE
            WHEN COALESCE(g.properties->>'pipeType', '') = '' THEN t.pipe_type_cn
            ELSE NULL
        END,
        'diameter',
        CASE
            WHEN COALESCE(g.properties->>'diameter', '') = '' THEN trim(to_char(t.diameter_mm, 'FM999999990.00'))
            ELSE NULL
        END,
        'diameter_mm',
        CASE
            WHEN COALESCE(g.properties->>'diameter_mm', '') = '' THEN trim(to_char(t.diameter_mm, 'FM999999990.00'))
            ELSE NULL
        END,
        'material',
        CASE
            WHEN COALESCE(g.properties->>'material', '') = '' THEN t.material
            ELSE NULL
        END,
        'depth',
        CASE
            WHEN COALESCE(g.properties->>'depth', '') = '' THEN t.depth_m
            ELSE NULL
        END,
        'depth_m',
        CASE
            WHEN COALESCE(g.properties->>'depth_m', '') = '' THEN t.depth_m
            ELSE NULL
        END,
        'installDate',
        CASE
            WHEN COALESCE(g.properties->>'installDate', '') = '' THEN t.install_date
            ELSE NULL
        END,
        'lastMaintain',
        CASE
            WHEN COALESCE(g.properties->>'lastMaintain', '') = '' THEN t.last_maintain_date
            ELSE NULL
        END,
        'pressure',
        CASE
            WHEN COALESCE(g.properties->>'pressure', '') = '' THEN t.pressure_value
            ELSE NULL
        END,
        'flowRate',
        CASE
            WHEN COALESCE(g.properties->>'flowRate', '') = '' THEN t.flow_value
            ELSE NULL
        END,
        'status',
        CASE
            WHEN COALESCE(g.properties->>'status', '') = '' THEN t.status_text
            ELSE NULL
        END,
        'area',
        CASE
            WHEN COALESCE(g.properties->>'area', '') = '' AND t.primary_building_name <> ''
                THEN t.primary_building_name
            WHEN COALESCE(g.properties->>'area', '') = ''
                THEN '校园主网'
            ELSE NULL
        END,
        'buildingId',
        CASE
            WHEN COALESCE(g.properties->>'buildingId', '') = '' AND t.primary_building_id <> ''
                THEN t.primary_building_id
            ELSE NULL
        END,
        'buildingName',
        CASE
            WHEN COALESCE(g.properties->>'buildingName', '') = '' AND t.primary_building_name <> ''
                THEN t.primary_building_name
            ELSE NULL
        END,
        'linkedBuilding',
        CASE
            WHEN COALESCE(g.properties->>'linkedBuilding', '') = '' AND t.primary_building_id <> ''
                THEN t.primary_building_id
            ELSE NULL
        END,
        'linkedBuildingName',
        CASE
            WHEN COALESCE(g.properties->>'linkedBuildingName', '') = '' AND t.primary_building_name <> ''
                THEN t.primary_building_name
            ELSE NULL
        END,
        'buildingIds',
        CASE
            WHEN NOT (g.properties ? 'buildingIds') AND cardinality(t.building_ids) > 0
                THEN to_jsonb(t.building_ids)
            ELSE NULL
        END,
        'buildingNames',
        CASE
            WHEN NOT (g.properties ? 'buildingNames') AND cardinality(t.building_names) > 0
                THEN to_jsonb(t.building_names)
            ELSE NULL
        END,
        'linkedBuildings',
        CASE
            WHEN NOT (g.properties ? 'linkedBuildings') AND cardinality(t.building_names) > 0
                THEN to_jsonb(t.building_names)
            ELSE NULL
        END,
        'linkedBuildingLabels',
        CASE
            WHEN NOT (g.properties ? 'linkedBuildingLabels') AND cardinality(t.building_names) > 0
                THEN to_jsonb(t.building_names)
            ELSE NULL
        END,
        'dataSource',
        CASE
            WHEN COALESCE(g.properties->>'dataSource', '') = '' THEN 'demo-backfill'
            ELSE NULL
        END
    )
)
FROM tmp_pipe_backfill t
WHERE g.id = t.feature_id
  AND g.layer IN ('pipes', 'roads');

UPDATE pipe_segments s
SET diameter_mm = COALESCE(s.diameter_mm, src.diameter_mm),
    material = COALESCE(NULLIF(s.material, ''), src.material),
    status = CASE
        WHEN (COALESCE(s.status, '') = '' OR s.status = 'normal')
             AND COALESCE(src.feature_properties->>'status', '') <> ''
            THEN src.feature_properties->>'status'
        ELSE COALESCE(s.status, 'normal')
    END,
    properties = s.properties || jsonb_strip_nulls(
        jsonb_build_object(
            'name',
            CASE
                WHEN COALESCE(s.properties->>'name', '') = '' THEN src.feature_properties->>'name'
                ELSE NULL
            END,
            'pipelineMedium',
            CASE
                WHEN COALESCE(s.properties->>'pipelineMedium', '') = '' THEN src.feature_properties->>'pipelineMedium'
                ELSE NULL
            END,
            'pipeType',
            CASE
                WHEN COALESCE(s.properties->>'pipeType', '') = '' THEN src.feature_properties->>'pipeType'
                ELSE NULL
            END,
            'diameter_mm',
            CASE
                WHEN COALESCE(s.properties->>'diameter_mm', '') = '' THEN trim(to_char(COALESCE(s.diameter_mm, src.diameter_mm), 'FM999999990.00'))
                ELSE NULL
            END,
            'material',
            CASE
                WHEN COALESCE(s.properties->>'material', '') = '' THEN COALESCE(NULLIF(s.material, ''), src.material)
                ELSE NULL
            END,
            'status',
            CASE
                WHEN COALESCE(s.properties->>'status', '') = '' THEN COALESCE(src.feature_properties->>'status', s.status, 'normal')
                ELSE NULL
            END,
            'area',
            CASE
                WHEN COALESCE(s.properties->>'area', '') = '' THEN src.feature_properties->>'area'
                ELSE NULL
            END,
            'buildingId',
            CASE
                WHEN COALESCE(s.properties->>'buildingId', '') = '' THEN src.feature_properties->>'buildingId'
                ELSE NULL
            END,
            'backfilled',
            true
        )
    )
FROM (
    SELECT
        t.feature_id,
        t.diameter_mm,
        t.material,
        g.properties AS feature_properties
    FROM tmp_pipe_backfill t
    JOIN geo_features g
        ON g.id = t.feature_id
       AND g.layer IN ('pipes', 'roads')
) src
WHERE s.feature_id = src.feature_id;

WITH node_stats AS (
    SELECT
        n.id,
        row_number() OVER (ORDER BY n.id) AS rn,
        count(DISTINCT s.id) AS segment_count,
        CASE
            WHEN bool_or(s.status = 'critical') THEN 'critical'
            WHEN bool_or(s.status = 'warning') THEN 'warning'
            ELSE 'normal'
        END AS derived_status
    FROM pipe_nodes n
    LEFT JOIN pipe_segments s
        ON s.from_node_id = n.id
        OR s.to_node_id = n.id
    GROUP BY n.id
)
UPDATE pipe_nodes n
SET name = CASE
        WHEN COALESCE(n.name, '') = '' OR n.name = n.id
            THEN '节点-' || lpad(ns.rn::text, 3, '0')
        ELSE n.name
    END,
    properties = n.properties || jsonb_strip_nulls(
        jsonb_build_object(
            'elevation',
            CASE
                WHEN COALESCE(n.properties->>'elevation', '') = ''
                    THEN round((4.60 + ((ns.rn - 1) % 9) * 0.55)::numeric, 2)
                ELSE NULL
            END,
            'status',
            CASE
                WHEN COALESCE(n.properties->>'status', '') = '' THEN ns.derived_status
                ELSE NULL
            END,
            'material',
            CASE
                WHEN COALESCE(n.properties->>'material', '') = ''
                    THEN CASE WHEN ns.segment_count >= 3 THEN '混凝土' ELSE 'PE' END
                ELSE NULL
            END,
            'segmentCount',
            CASE
                WHEN COALESCE(n.properties->>'segmentCount', '') = '' THEN ns.segment_count
                ELSE NULL
            END,
            'backfilled',
            true
        )
    )
FROM node_stats ns
WHERE n.id = ns.id;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(t.feature_id || '_pressure'), 1, 12),
    t.feature_id,
    'pressure',
    t.pressure_value::double precision,
    'bar',
    now(),
    'good',
    'demo-backfill'
FROM tmp_pipe_backfill t
ON CONFLICT (point_id, metric) DO NOTHING;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(t.feature_id || '_flow'), 1, 12),
    t.feature_id,
    'flow',
    t.flow_value::double precision,
    'm3/h',
    now(),
    'good',
    'demo-backfill'
FROM tmp_pipe_backfill t
ON CONFLICT (point_id, metric) DO NOTHING;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(t.feature_id || '_turbidity'), 1, 12),
    t.feature_id,
    'turbidity',
    t.turbidity_value::double precision,
    'NTU',
    now(),
    'good',
    'demo-backfill'
FROM tmp_pipe_backfill t
ON CONFLICT (point_id, metric) DO NOTHING;

INSERT INTO telemetry_latest (point_id, feature_id, metric, value, unit, sampled_at, quality, source)
SELECT
    'tp_' || substr(md5(t.feature_id || '_chlorine'), 1, 12),
    t.feature_id,
    'chlorine',
    t.chlorine_value::double precision,
    'mg/L',
    now(),
    'good',
    'demo-backfill'
FROM tmp_pipe_backfill t
WHERE t.pipeline_medium = 'water'
ON CONFLICT (point_id, metric) DO NOTHING;

COMMIT;
