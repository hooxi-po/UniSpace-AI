-- Extend twin entity model for:
-- pipe segment -> manhole -> valve -> pump station -> building -> floor -> room
-- Relations are represented through existing asset_relations table.

CREATE TABLE IF NOT EXISTS pipe_valves (
    id TEXT PRIMARY KEY,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    node_id TEXT REFERENCES pipe_nodes(id) ON DELETE SET NULL,
    segment_id TEXT REFERENCES pipe_segments(id) ON DELETE SET NULL,
    valve_type TEXT NOT NULL DEFAULT 'gate',
    status TEXT NOT NULL DEFAULT 'open',
    control_mode TEXT NOT NULL DEFAULT 'manual',
    normal_state TEXT NOT NULL DEFAULT 'open',
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipe_valves_feature_idx ON pipe_valves(feature_id);
CREATE INDEX IF NOT EXISTS pipe_valves_node_idx ON pipe_valves(node_id);
CREATE INDEX IF NOT EXISTS pipe_valves_segment_idx ON pipe_valves(segment_id);
CREATE INDEX IF NOT EXISTS pipe_valves_status_idx ON pipe_valves(status);
CREATE INDEX IF NOT EXISTS pipe_valves_properties_gin ON pipe_valves USING GIN (properties);

DROP TRIGGER IF EXISTS trg_pipe_valves_updated_at ON pipe_valves;
CREATE TRIGGER trg_pipe_valves_updated_at
BEFORE UPDATE ON pipe_valves
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS pump_stations (
    id TEXT PRIMARY KEY,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    node_id TEXT REFERENCES pipe_nodes(id) ON DELETE SET NULL,
    name TEXT,
    station_type TEXT NOT NULL DEFAULT 'booster',
    status TEXT NOT NULL DEFAULT 'normal',
    design_flow_m3h NUMERIC(12, 2),
    design_head_m NUMERIC(12, 2),
    power_kw NUMERIC(12, 2),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pump_stations_feature_idx ON pump_stations(feature_id);
CREATE INDEX IF NOT EXISTS pump_stations_node_idx ON pump_stations(node_id);
CREATE INDEX IF NOT EXISTS pump_stations_status_idx ON pump_stations(status);
CREATE INDEX IF NOT EXISTS pump_stations_type_idx ON pump_stations(station_type);
CREATE INDEX IF NOT EXISTS pump_stations_properties_gin ON pump_stations USING GIN (properties);

DROP TRIGGER IF EXISTS trg_pump_stations_updated_at ON pump_stations;
CREATE TRIGGER trg_pump_stations_updated_at
BEFORE UPDATE ON pump_stations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS pipe_manholes (
    id TEXT PRIMARY KEY,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    node_id TEXT REFERENCES pipe_nodes(id) ON DELETE SET NULL,
    manhole_type TEXT NOT NULL DEFAULT 'inspection',
    cover_status TEXT NOT NULL DEFAULT 'closed',
    gas_risk_level TEXT NOT NULL DEFAULT 'normal',
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipe_manholes_feature_idx ON pipe_manholes(feature_id);
CREATE INDEX IF NOT EXISTS pipe_manholes_node_idx ON pipe_manholes(node_id);
CREATE INDEX IF NOT EXISTS pipe_manholes_cover_status_idx ON pipe_manholes(cover_status);
CREATE INDEX IF NOT EXISTS pipe_manholes_properties_gin ON pipe_manholes USING GIN (properties);

DROP TRIGGER IF EXISTS trg_pipe_manholes_updated_at ON pipe_manholes;
CREATE TRIGGER trg_pipe_manholes_updated_at
BEFORE UPDATE ON pipe_manholes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS building_floors (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES geo_features(id) ON DELETE CASCADE,
    floor_no INTEGER NOT NULL,
    floor_name TEXT,
    usage_type TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT building_floors_unique_id_building UNIQUE (id, building_id),
    CONSTRAINT building_floors_unique_floor UNIQUE (building_id, floor_no)
);

CREATE INDEX IF NOT EXISTS building_floors_building_idx ON building_floors(building_id);
CREATE INDEX IF NOT EXISTS building_floors_floor_no_idx ON building_floors(floor_no);
CREATE INDEX IF NOT EXISTS building_floors_properties_gin ON building_floors USING GIN (properties);

DROP TRIGGER IF EXISTS trg_building_floors_updated_at ON building_floors;
CREATE TRIGGER trg_building_floors_updated_at
BEFORE UPDATE ON building_floors
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS building_rooms (
    id TEXT PRIMARY KEY,
    floor_id TEXT NOT NULL,
    building_id TEXT NOT NULL REFERENCES geo_features(id) ON DELETE CASCADE,
    room_no TEXT NOT NULL,
    room_name TEXT,
    room_type TEXT,
    area_m2 NUMERIC(12, 2),
    status TEXT NOT NULL DEFAULT 'normal',
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT building_rooms_floor_building_fk
        FOREIGN KEY (floor_id, building_id)
        REFERENCES building_floors(id, building_id)
        ON DELETE CASCADE,
    CONSTRAINT building_rooms_unique_room UNIQUE (building_id, room_no)
);

CREATE INDEX IF NOT EXISTS building_rooms_floor_idx ON building_rooms(floor_id);
CREATE INDEX IF NOT EXISTS building_rooms_building_idx ON building_rooms(building_id);
CREATE INDEX IF NOT EXISTS building_rooms_room_no_idx ON building_rooms(room_no);
CREATE INDEX IF NOT EXISTS building_rooms_status_idx ON building_rooms(status);
CREATE INDEX IF NOT EXISTS building_rooms_properties_gin ON building_rooms USING GIN (properties);

DROP TRIGGER IF EXISTS trg_building_rooms_updated_at ON building_rooms;
CREATE TRIGGER trg_building_rooms_updated_at
BEFORE UPDATE ON building_rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
