-- ═══════════════════════════════════════════════════════════════════
--  REMOVE THE REWARDS SYSTEM
--  Run in the Supabase SQL Editor AFTER deploying the code that no
--  longer references these objects.
--
--  ⚠  This permanently deletes every point balance, streak, and
--     redemption record. If you might reinstate rewards later, take a
--     backup first (Supabase → Database → Backups), or simply skip
--     this file — the tables are harmless if left in place and the app
--     no longer touches them.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists award_points(uuid, text);
drop function if exists redeem_reward(uuid, uuid, jsonb);
drop function if exists today_actions(uuid);

drop table if exists redemptions;
drop table if exists rewards_catalog;
drop table if exists point_events;
drop table if exists user_points;
