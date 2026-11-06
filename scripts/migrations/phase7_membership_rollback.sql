-- ==============================================================================
-- Rollback Migration Phase 7: Membership & Subscribe & Save Engine
-- ==============================================================================

DROP TABLE IF EXISTS loyalty_point_ledger CASCADE;
DROP TABLE IF EXISTS subscription_schedules CASCADE;
DROP TABLE IF EXISTS subscription_items CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_memberships CASCADE;
DROP TABLE IF EXISTS membership_tiers CASCADE;
