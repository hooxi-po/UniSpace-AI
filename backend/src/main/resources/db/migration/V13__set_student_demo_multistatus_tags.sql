-- V13: Student demo multi-status tags for presentation
-- DB status remains compatible (Occupied/Empty), while department carries demo tags.

WITH student_ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn,
    COUNT(*) OVER () AS cnt
  FROM rooms
  WHERE type = 'Student'
),
student_labeled AS (
  SELECT
    id,
    CASE
      WHEN rn <= FLOOR(cnt * 0.45) THEN '在住'
      WHEN rn <= FLOOR(cnt * 0.75) THEN '空置'
      WHEN rn <= FLOOR(cnt * 0.90) THEN '维修中'
      ELSE '预留'
    END AS demo_label
  FROM student_ranked
)
UPDATE rooms r
SET
  status = CASE
    WHEN s.demo_label = '在住' THEN 'Occupied'
    ELSE 'Empty'
  END,
  department = CONCAT('演示状态:', s.demo_label)
FROM student_labeled s
WHERE r.id = s.id;