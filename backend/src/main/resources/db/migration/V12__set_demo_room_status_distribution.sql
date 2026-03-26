@"
-- Demo distribution (DB-side), compatible with current status domain
-- TeacherApartment: 50% Occupied / 50% Empty
WITH teacher_ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY id) AS rn,
         COUNT(*) OVER () AS cnt
  FROM rooms
  WHERE type = 'TeacherApartment'
), teacher_target AS (
  SELECT id,
         CASE WHEN rn <= FLOOR(cnt * 0.5) THEN 'Occupied' ELSE 'Empty' END AS new_status
  FROM teacher_ranked
)
UPDATE rooms r
SET status = t.new_status
FROM teacher_target t
WHERE r.id = t.id;

-- Student: 50% Occupied / 50% Empty
WITH student_ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY id) AS rn,
         COUNT(*) OVER () AS cnt
  FROM rooms
  WHERE type = 'Student'
), student_target AS (
  SELECT id,
         CASE WHEN rn <= FLOOR(cnt * 0.5) THEN 'Occupied' ELSE 'Empty' END AS new_status
  FROM student_ranked
)
UPDATE rooms r
SET status = s.new_status
FROM student_target s
WHERE r.id = s.id;
"@ | Set-Content -Path "D:\UniSpace-AI\backend\src\main\resources\db\migration\V12__set_demo_room_status_distribution.sql"