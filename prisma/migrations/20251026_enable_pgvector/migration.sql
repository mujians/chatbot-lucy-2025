-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add comment to explain pgvector usage
COMMENT ON EXTENSION vector IS 'pgvector extension for semantic similarity search using embeddings';

-- Ensure embedding column exists with correct type
-- Note: If table doesn't exist yet, this migration will be applied after initial schema creation
DO $$
BEGIN
    -- Check if KnowledgeItem table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'KnowledgeItem') THEN
        -- Check if embedding column needs to be altered (only if it's not already vector type)
        IF EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'KnowledgeItem'
            AND column_name = 'embedding'
            AND data_type != 'USER-DEFINED'
        ) THEN
            -- Alter column to vector type
            ALTER TABLE "KnowledgeItem"
            ALTER COLUMN embedding TYPE vector(1536) USING embedding::text::vector(1536);

            RAISE NOTICE 'Converted embedding column to vector(1536) type';
        END IF;

        -- Create index for fast similarity search
        IF NOT EXISTS (
            SELECT FROM pg_indexes
            WHERE tablename = 'KnowledgeItem'
            AND indexname = 'KnowledgeItem_embedding_idx'
        ) THEN
            CREATE INDEX "KnowledgeItem_embedding_idx"
            ON "KnowledgeItem"
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);

            RAISE NOTICE 'Created ivfflat index on embedding column for fast cosine similarity search';
        END IF;
    END IF;
END
$$;
