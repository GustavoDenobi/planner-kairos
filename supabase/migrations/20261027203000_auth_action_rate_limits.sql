-- Shared counters for password recovery and public signup edge functions.
-- No policies: only the service role (and the definer) may read or write rows.

CREATE TABLE auth_action_rate_limits (
  action TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (action, bucket_key, window_start)
);

ALTER TABLE auth_action_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE auth_action_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE auth_action_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION assert_rate_limit(
  p_action TEXT,
  p_bucket_key TEXT,
  p_max_count INT,
  p_window_seconds INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_max_count < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_rate_limit';
  END IF;

  IF btrim(COALESCE(p_action, '')) = '' OR btrim(COALESCE(p_bucket_key, '')) = '' THEN
    RAISE EXCEPTION 'invalid_rate_limit';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO auth_action_rate_limits (action, bucket_key, window_start, hit_count)
  VALUES (p_action, p_bucket_key, v_window_start, 1)
  ON CONFLICT (action, bucket_key, window_start)
  DO UPDATE SET hit_count = auth_action_rate_limits.hit_count + 1
  RETURNING hit_count INTO v_count;

  DELETE FROM auth_action_rate_limits
  WHERE window_start < clock_timestamp() - interval '1 day';

  IF v_count > p_max_count THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION assert_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assert_rate_limit(TEXT, TEXT, INT, INT) TO service_role;
