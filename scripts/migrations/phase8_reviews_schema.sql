-- ==============================================================================
-- MIGRATION PHASE 8: HỆ THỐNG ĐÁNH GIÁ SẢN PHẨM & SOCIAL PROOF (PRODUCT REVIEWS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(64),
  order_id VARCHAR(64),
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30),
  variant_info VARCHAR(100) DEFAULT 'Lốc 7 chai (330ml)',
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  is_verified_buyer BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  helpful_count INT NOT NULL DEFAULT 0,
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  admin_replied_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON product_reviews (product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON product_reviews (product_id, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON product_reviews (created_at DESC);

CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id VARCHAR(64) PRIMARY KEY,
  review_id VARCHAR(64) NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id VARCHAR(64),
  fingerprint VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_helpful_votes_review ON review_helpful_votes (review_id);
