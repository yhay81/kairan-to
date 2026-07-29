WITH
telemetry AS (
  SELECT
    COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_id END) AS users,
    COUNT(DISTINCT CASE WHEN name = 'link_copied' THEN context END) AS links_copied,
    COUNT(DISTINCT CASE WHEN name = 'owner_opened' THEN context END) AS owner_opened,
    COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_id END) AS returned,
    COUNT(DISTINCT CASE
      WHEN name = 'visited' AND occurred_on >= date('now', '-6 days') THEN session_id
    END) AS users_7d
  FROM product_events
),
notice_counts AS (
  SELECT
    COUNT(*) AS notices_created,
    COUNT(DISTINCT creator_session_id) AS organizers,
    COUNT(CASE WHEN response_mode = 'attendance' THEN 1 END) AS attendance_notices,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) AS notices_closed,
    COUNT(CASE WHEN created_at >= unixepoch() - (7 * 86400) THEN 1 END) AS notices_7d
  FROM notices
  WHERE status <> 'hidden'
),
read_counts AS (
  SELECT
    COUNT(*) AS reads_saved,
    COUNT(DISTINCT acknowledgements.respondent_session_id) AS respondents,
    COUNT(DISTINCT acknowledgements.notice_id) AS notices_with_reads
  FROM acknowledgements
  JOIN notices ON notices.id = acknowledgements.notice_id
  WHERE notices.status <> 'hidden'
),
deep_notices AS (
  SELECT
    COUNT(CASE WHEN read_count >= 10 THEN 1 END) AS notices_with_ten_reads,
    COUNT(CASE WHEN read_count >= expected_count THEN 1 END) AS notices_completed
  FROM (
    SELECT
      notices.id,
      notices.expected_count,
      COUNT(acknowledgements.id) AS read_count
    FROM notices
    LEFT JOIN acknowledgements ON acknowledgements.notice_id = notices.id
    WHERE notices.status <> 'hidden'
    GROUP BY notices.id, notices.expected_count
  )
),
repeat_organizers AS (
  SELECT COUNT(*) AS repeat_organizers
  FROM (
    SELECT creator_session_id
    FROM notices
    WHERE status <> 'hidden'
    GROUP BY creator_session_id
    HAVING COUNT(*) >= 2
  )
)
SELECT
  telemetry.*,
  notice_counts.*,
  read_counts.*,
  deep_notices.*,
  repeat_organizers.repeat_organizers
FROM telemetry, notice_counts, read_counts, deep_notices, repeat_organizers;
