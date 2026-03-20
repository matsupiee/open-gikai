#!/usr/bin/env bash
set -euo pipefail

# WorktreeCreate hook: デフォルトの git worktree add を置き換える
# stdin から JSON を受け取り、worktree を作成してセットアップする
# 最後に worktree の絶対パスを stdout に出力する（必須）

# --- 0. PATH にツールを追加 ---
export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$HOME/.bun/bin:$PATH"
if command -v mise &>/dev/null; then
  eval "$(mise env 2>/dev/null)" || true
fi

# --- 1. stdin から worktree 名を取得し、worktree を作成 ---
NAME=$(jq -r .name)
DIR="$HOME/.claude/worktrees/$NAME"

git worktree add "$DIR" HEAD >&2
echo "Worktree created: $DIR" >&2

# --- 2. .env をメインリポジトリからコピー ---
if [ -f "$CLAUDE_PROJECT_DIR/.env" ]; then
  cp "$CLAUDE_PROJECT_DIR/.env" "$DIR/.env"
  echo "✓ .env copied from main repo" >&2
else
  echo "⚠ .env not found in main repo: $CLAUDE_PROJECT_DIR" >&2
fi

# .env.local も存在すればコピー
if [ -f "$CLAUDE_PROJECT_DIR/.env.local" ]; then
  cp "$CLAUDE_PROJECT_DIR/.env.local" "$DIR/.env.local"
  echo "✓ .env.local copied from main repo" >&2
fi

# --- 3. mise trust ---
cd "$DIR"
if command -v mise &>/dev/null; then
  mise trust
  echo "✓ mise trust done" >&2
else
  echo "⚠ mise not found, skipping mise trust" >&2
fi

# --- 4. bun install ---
if command -v bun &>/dev/null; then
  bun install --frozen-lockfile
  echo "✓ bun install done" >&2
else
  echo "⚠ bun not found, skipping bun install" >&2
fi

echo "" >&2
echo "=== Worktree setup complete ===" >&2

# 最後に worktree パスを stdout に出力（必須）
echo "$DIR"
