-- Read-only JSON report for Umami 3.5 / PostgreSQL. Identity is distinct_id,
-- never session_id: a change of IP or Umami's salt must not add another player.
-- psql -v since=2026-11-01T00:00:00Z -v until=2026-12-01T00:00:00Z
\if :{?since}
\else
\set since '1970-01-01T00:00:00Z'
\endif
\if :{?until}
\else
\set until 'now'
\endif
WITH events AS MATERIALIZED (
  SELECT e.created_at, e.event_name, s.distinct_id AS player_id,
    COALESCE(properties.data, '{}'::jsonb) AS data
  FROM website_event e
  JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(d.data_key,
      COALESCE(to_jsonb(d.string_value), to_jsonb(d.number_value), 'null'::jsonb)) AS data
    FROM event_data d WHERE d.website_event_id = e.event_id
  ) properties ON true
  WHERE e.website_id = '638df471-e15b-4dfb-914b-447083317254'::uuid
    AND e.created_at >= :'since'::timestamptz AND e.created_at < :'until'::timestamptz
    AND e.event_name IS NOT NULL AND s.distinct_id IS NOT NULL
), totals AS (
  SELECT count(DISTINCT player_id) AS players_observed,
    count(DISTINCT player_id) FILTER (WHERE event_name IN ('flight_started', 'flight_resumed')) AS players_flew,
    count(*) FILTER (WHERE event_name = 'game_opened') AS game_opens,
    count(*) FILTER (WHERE event_name = 'expedition_started') AS expeditions_started,
    count(*) FILTER (WHERE event_name = 'flight_started') AS flights_started,
    count(*) FILTER (WHERE event_name = 'flight_finished' AND data->>'outcome' IN ('arrived', 'flyby')) AS flights_completed,
    count(*) FILTER (WHERE event_name = 'flight_cancelled') AS flights_cancelled,
    count(*) FILTER (WHERE event_name = 'object_card_opened') AS cards_opened,
    count(*) FILTER (WHERE event_name = 'theme_changed') AS theme_changes,
    count(DISTINCT player_id) FILTER (WHERE event_name = 'theme_changed') AS players_changed_theme,
    count(*) FILTER (WHERE event_name = 'quest_completed') AS quests_completed,
    COALESCE(sum((data->>'seconds')::numeric) FILTER (WHERE event_name = 'active_time'), 0) AS active_seconds
  FROM events
), players AS (
  SELECT player_id, min(created_at) AS first_seen, max(created_at) AS last_seen,
    count(DISTINCT data->>'expedition_id') AS expeditions_observed,
    count(*) FILTER (WHERE event_name = 'expedition_started') AS expeditions_started,
    count(*) FILTER (WHERE event_name = 'flight_started') AS flights_started,
    count(*) FILTER (WHERE event_name = 'object_card_opened') AS cards_opened,
    count(*) FILTER (WHERE event_name = 'quest_completed') AS quests_completed
  FROM events GROUP BY player_id
), expeditions AS (
  SELECT player_id, data->>'expedition_id' AS expedition_id,
    max((data->>'expedition_number')::numeric::integer) AS expedition_number,
    bool_or(event_name = 'expedition_started') AS start_observed,
    bool_or(event_name = 'expedition_ended') AS reset_observed,
    count(*) FILTER (WHERE event_name = 'flight_started') AS flights_started,
    count(*) FILTER (WHERE event_name = 'flight_finished' AND data->>'outcome' IN ('arrived', 'flyby')) AS flights_completed,
    count(*) FILTER (WHERE event_name = 'flight_cancelled') AS flights_cancelled,
    count(*) FILTER (WHERE event_name = 'object_card_opened') AS cards_opened,
    count(*) FILTER (WHERE event_name = 'theme_changed') AS theme_changes,
    count(*) FILTER (WHERE event_name = 'quest_completed') AS quests_completed,
    COALESCE(sum((data->>'seconds')::numeric) FILTER (WHERE event_name = 'active_time'), 0) AS active_seconds
  FROM events WHERE data->>'expedition_id' IS NOT NULL
  GROUP BY player_id, data->>'expedition_id'
), themes AS (
  SELECT data->>'from_theme' AS from_theme, data->>'to_theme' AS to_theme,
    count(*) AS changes, count(DISTINCT player_id) AS players
  FROM events WHERE event_name = 'theme_changed' GROUP BY 1, 2
), quests AS (
  SELECT data->>'quest_id' AS quest_id,
    count(*) FILTER (WHERE event_name = 'quest_started') AS starts,
    count(*) FILTER (WHERE event_name = 'quest_completed') AS completions
  FROM events WHERE event_name IN ('quest_started', 'quest_completed') GROUP BY 1
), cards AS (
  SELECT data->>'object_id' AS object_id, count(*) AS opens, count(DISTINCT player_id) AS players
  FROM events WHERE event_name = 'object_card_opened' GROUP BY 1
)
SELECT jsonb_build_object(
  'since', :'since'::timestamptz, 'until', :'until'::timestamptz,
  'totals', (SELECT to_jsonb(totals) FROM totals),
  'players', COALESCE((SELECT jsonb_agg(to_jsonb(players) ORDER BY player_id) FROM players), '[]'::jsonb),
  'expeditions', COALESCE((SELECT jsonb_agg(to_jsonb(expeditions) ORDER BY player_id, expedition_number, expedition_id) FROM expeditions), '[]'::jsonb),
  'themes', COALESCE((SELECT jsonb_agg(to_jsonb(themes) ORDER BY changes DESC, to_theme) FROM themes), '[]'::jsonb),
  'quests', COALESCE((SELECT jsonb_agg(to_jsonb(quests) ORDER BY quest_id) FROM quests), '[]'::jsonb),
  'cards', COALESCE((SELECT jsonb_agg(to_jsonb(cards) ORDER BY opens DESC, object_id) FROM cards), '[]'::jsonb)
);
