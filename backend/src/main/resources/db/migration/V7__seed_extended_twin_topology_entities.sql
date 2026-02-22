-- Seed extended twin entities and relations to make segment -> manhole -> valve -> pump station -> building -> floor -> room navigable.

INSERT INTO pipe_manholes (id, node_id, manhole_type, cover_status, gas_risk_level, properties)
SELECT
    'mh_' || substr(md5(n.id), 1, 12) AS id,
    n.id,
    'inspection',
    'closed',
    'normal',
    jsonb_build_object('seeded', true)
FROM pipe_nodes n
ON CONFLICT (id) DO UPDATE
SET node_id = EXCLUDED.node_id,
    properties = pipe_manholes.properties || EXCLUDED.properties,
    updated_at = now();

INSERT INTO pipe_valves (id, feature_id, node_id, segment_id, valve_type, status, control_mode, normal_state, properties)
SELECT
    'valve_' || substr(md5(s.id), 1, 12) AS id,
    s.feature_id,
    COALESCE(s.to_node_id, s.from_node_id) AS node_id,
    s.id,
    'gate',
    'open',
    'manual',
    'open',
    jsonb_build_object('seeded', true)
FROM pipe_segments s
ON CONFLICT (id) DO UPDATE
SET feature_id = COALESCE(EXCLUDED.feature_id, pipe_valves.feature_id),
    node_id = COALESCE(EXCLUDED.node_id, pipe_valves.node_id),
    segment_id = COALESCE(EXCLUDED.segment_id, pipe_valves.segment_id),
    properties = pipe_valves.properties || EXCLUDED.properties,
    updated_at = now();

WITH ranked_segments AS (
    SELECT s.*, row_number() OVER (ORDER BY s.id) AS rn
    FROM pipe_segments s
)
INSERT INTO pump_stations (
    id,
    feature_id,
    node_id,
    name,
    station_type,
    status,
    design_flow_m3h,
    design_head_m,
    power_kw,
    properties
)
SELECT
    'pump_' || substr(md5(rs.id), 1, 12),
    rs.feature_id,
    COALESCE(rs.from_node_id, rs.to_node_id),
    'Pump-' || substr(rs.id, 1, 8),
    'booster',
    'normal',
    120,
    32,
    45,
    jsonb_build_object('seeded', true)
FROM ranked_segments rs
WHERE rs.rn % 10 = 1
ON CONFLICT (id) DO UPDATE
SET feature_id = COALESCE(EXCLUDED.feature_id, pump_stations.feature_id),
    node_id = COALESCE(EXCLUDED.node_id, pump_stations.node_id),
    properties = pump_stations.properties || EXCLUDED.properties,
    updated_at = now();

WITH base_buildings AS (
    SELECT
        g.id AS building_id,
        LEAST(
            GREATEST(
                COALESCE(NULLIF(regexp_replace(COALESCE(g.properties->>'building:levels', ''), '[^0-9]', '', 'g'), '')::int, 3),
                1
            ),
            8
        ) AS floor_count
    FROM geo_features g
    WHERE g.layer = 'buildings'
),
floor_seed AS (
    SELECT b.building_id, gs AS floor_no
    FROM base_buildings b
    JOIN LATERAL generate_series(1, b.floor_count) gs ON TRUE
)
INSERT INTO building_floors (id, building_id, floor_no, floor_name, usage_type, properties)
SELECT
    'floor_' || substr(md5(f.building_id || '_' || f.floor_no::text), 1, 16),
    f.building_id,
    f.floor_no,
    'F' || f.floor_no::text,
    NULL,
    jsonb_build_object('seeded', true)
FROM floor_seed f
ON CONFLICT (building_id, floor_no) DO UPDATE
SET properties = building_floors.properties || EXCLUDED.properties,
    updated_at = now();

WITH room_seed AS (
    SELECT
        f.id AS floor_id,
        f.building_id,
        f.floor_no,
        room_idx
    FROM building_floors f
    JOIN LATERAL generate_series(1, 4) room_idx ON TRUE
)
INSERT INTO building_rooms (
    id,
    floor_id,
    building_id,
    room_no,
    room_name,
    room_type,
    area_m2,
    status,
    properties
)
SELECT
    'room_' || substr(md5(r.floor_id || '_' || r.room_idx::text), 1, 16),
    r.floor_id,
    r.building_id,
    r.floor_no::text || lpad(r.room_idx::text, 2, '0'),
    'Room-' || r.floor_no::text || lpad(r.room_idx::text, 2, '0'),
    CASE r.room_idx
        WHEN 1 THEN 'office'
        WHEN 2 THEN 'classroom'
        WHEN 3 THEN 'lab'
        ELSE 'dorm'
    END,
    18 + (r.room_idx * 3),
    'normal',
    jsonb_build_object('seeded', true)
FROM room_seed r
ON CONFLICT (building_id, room_no) DO UPDATE
SET floor_id = EXCLUDED.floor_id,
    properties = building_rooms.properties || EXCLUDED.properties,
    updated_at = now();

INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    s.id,
    'pipe_segment',
    m.id,
    'manhole',
    'connects',
    jsonb_build_object('seeded', true)
FROM pipe_segments s
JOIN pipe_manholes m ON m.node_id = s.to_node_id
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    m.id,
    'manhole',
    v.id,
    'valve',
    'controls',
    jsonb_build_object('seeded', true)
FROM pipe_manholes m
JOIN pipe_valves v ON v.node_id = m.node_id
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    v.id,
    'valve',
    p.id,
    'pump_station',
    'feeds',
    jsonb_build_object('seeded', true)
FROM pipe_valves v
JOIN pump_stations p ON p.node_id = v.node_id
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

WITH pump_features AS (
    SELECT p.id AS pump_id, g.geom
    FROM pump_stations p
    JOIN geo_features g ON g.id = p.feature_id
),
nearest_building AS (
    SELECT
        pf.pump_id,
        b.id AS building_id,
        row_number() OVER (PARTITION BY pf.pump_id ORDER BY pf.geom <-> b.geom) AS rn
    FROM pump_features pf
    JOIN geo_features b ON b.layer = 'buildings'
)
INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    nb.pump_id,
    'pump_station',
    nb.building_id,
    'building',
    'serves',
    jsonb_build_object('seeded', true)
FROM nearest_building nb
WHERE nb.rn = 1
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    f.building_id,
    'building',
    f.id,
    'floor',
    'contains',
    jsonb_build_object('seeded', true)
FROM building_floors f
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;

INSERT INTO asset_relations (source_id, source_type, target_id, target_type, relation_type, properties)
SELECT
    r.floor_id,
    'floor',
    r.id,
    'room',
    'contains',
    jsonb_build_object('seeded', true)
FROM building_rooms r
ON CONFLICT (source_id, source_type, target_id, target_type, relation_type) DO NOTHING;
