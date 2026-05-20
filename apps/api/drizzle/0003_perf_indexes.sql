-- HNSW vector index for cosine similarity searches on /feed and /chat.
-- Without this, every similarity query does a full sequential scan (O(n)).
-- HNSW gives O(log n) approximate nearest-neighbor lookups.
CREATE INDEX IF NOT EXISTS "articles_embedding_hnsw_idx" ON "articles" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
-- Partial index for the unsummarized-article query in ai.service.ts.
-- Only indexes rows where summary IS NULL, keeping it small and fast.
CREATE INDEX IF NOT EXISTS "articles_summary_null_idx" ON "articles" (id) WHERE summary IS NULL;
