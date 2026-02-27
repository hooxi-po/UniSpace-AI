-- V8: 创建 buildings 和 rooms 表（业务域，与 Twin 的 building_rooms 分离）
CREATE TABLE IF NOT EXISTS buildings (
  code TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  building_name TEXT NOT NULL,
  contractor TEXT,
  supervisor TEXT,
  contract_amount BIGINT,
  audit_amount BIGINT,
  fund_source TEXT,
  location TEXT,
  planned_area INT,
  floor_count INT,
  room_count INT,
  project_manager TEXT,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  building_code TEXT NOT NULL REFERENCES buildings(code) ON DELETE CASCADE,
  building_name TEXT,
  room_no TEXT,
  floor INT,
  area INT,
  type TEXT,
  status TEXT,
  department TEXT,
  main_category TEXT,
  sub_category TEXT
);

CREATE INDEX IF NOT EXISTS idx_rooms_building_code ON rooms(building_code);