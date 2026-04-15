CREATE TABLE IF NOT EXISTS property_service_workorders (
  id BIGSERIAL PRIMARY KEY,
  workorder_no VARCHAR(64) NOT NULL UNIQUE,
  room_id VARCHAR(128) NOT NULL,
  room_label VARCHAR(128) NOT NULL,
  asset_name VARCHAR(128) NOT NULL,
  fault_desc TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL,
  reporter VARCHAR(64) NOT NULL,
  report_phone VARCHAR(64),
  team_name VARCHAR(64),
  assignee VARCHAR(64),
  plan_arrival_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_service_workorder_logs (
  id BIGSERIAL PRIMARY KEY,
  workorder_id BIGINT NOT NULL REFERENCES property_service_workorders(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  detail TEXT,
  operator_name VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psw_status ON property_service_workorders(status);
CREATE INDEX IF NOT EXISTS idx_psw_priority ON property_service_workorders(priority);
CREATE INDEX IF NOT EXISTS idx_psw_created_at ON property_service_workorders(created_at DESC);








