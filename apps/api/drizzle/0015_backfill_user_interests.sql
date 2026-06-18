INSERT INTO "user_interests" ("user_id", "tags", "query_embedding")
SELECT id, '{}'::text[], NULL FROM "users"
ON CONFLICT (user_id) DO NOTHING;
