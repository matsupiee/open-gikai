-- pgvector拡張有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- content_tsv GINインデックス
CREATE INDEX IF NOT EXISTS statements_content_tsv_idx ON statements USING gin (content_tsv);

-- embedding HNSWインデックス
CREATE INDEX IF NOT EXISTS statements_embedding_idx ON statements USING hnsw (embedding vector_cosine_ops);
