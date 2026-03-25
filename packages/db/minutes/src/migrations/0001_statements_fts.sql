-- Custom SQL migration file, put your code below! --
-- `bun run drizzle-kit generate --custom --name=statements_fts`で生成しました

CREATE VIRTUAL TABLE IF NOT EXISTS statements_fts USING fts5(
    statement_id UNINDEXED,
    bigrams,
    tokenize = 'unicode61'
)