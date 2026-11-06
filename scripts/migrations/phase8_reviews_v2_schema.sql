-- ==============================================================================
-- MIGRATION PHASE 8 V2: RATE LIMITING & CHỐNG SPAM ĐÁNH GIÁ (IDEMPOTENT)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS review_rate_limits (
  id VARCHAR(64) PRIMARY KEY,
  ip_address VARCHAR(64) NOT NULL,
  phone VARCHAR(30),
  user_id VARCHAR(64),
  product_id VARCHAR(100) NOT NULL,
  comment_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created ON review_rate_limits(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_phone_prod ON review_rate_limits(phone, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_hash ON review_rate_limits(comment_hash, created_at DESC);
