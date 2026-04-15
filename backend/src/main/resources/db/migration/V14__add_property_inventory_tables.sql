CREATE TABLE IF NOT EXISTS property_inventory_tasks (
  id              BIGSERIAL PRIMARY KEY,
  task_no          VARCHAR(64) UNIQUE NOT NULL,
  year_no          INT NOT NULL,
  task_name        VARCHAR(255) NOT NULL,
  building_code    VARCHAR(64),
  building_name    VARCHAR(255) NOT NULL,
  scope            TEXT NOT NULL,
  owner_dept       VARCHAR(255) NOT NULL,
  leader           VARCHAR(128) NOT NULL,
  due_date         DATE NOT NULL,
  status           VARCHAR(32) NOT NULL,         -- 未开始/进行中/待复核/已完成/逾期
  phase            VARCHAR(32) NOT NULL,         -- 准备阶段/现场盘点/差异复核/结果归档
  progress         INT NOT NULL DEFAULT 0,
  checked_assets   INT NOT NULL DEFAULT 0,
  total_assets     INT NOT NULL DEFAULT 0,
  discrepancy_count INT NOT NULL DEFAULT 0,
  last_updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_inventory_discrepancies (
  id               BIGSERIAL PRIMARY KEY,
  task_id          BIGINT NOT NULL REFERENCES property_inventory_tasks(id) ON DELETE CASCADE,
  issue_no         VARCHAR(64) UNIQUE NOT NULL,
  asset_code       VARCHAR(128) NOT NULL,
  asset_name       VARCHAR(255) NOT NULL,
  location         VARCHAR(255) NOT NULL,
  problem_type     VARCHAR(32) NOT NULL,         -- 缺失/位置异常/状态异常/账实不符
  severity         VARCHAR(16) NOT NULL,         -- 低/中/高
  suggestion       TEXT NOT NULL,
  discovered_at    TIMESTAMP NOT NULL,
  reviewer         VARCHAR(128),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tasks_year_status
  ON property_inventory_tasks(year_no, status);

CREATE INDEX IF NOT EXISTS idx_inventory_discrepancies_task
  ON property_inventory_discrepancies(task_id);