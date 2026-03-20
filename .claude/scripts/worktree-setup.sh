#!/usr/bin/env bash
set -euo pipefail

WORKTREE_ROOT="$(pwd)"

# メインリポジトリのパスを取得
MAIN_REPO=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
echo "Main repo: $MAIN_REPO"
echo "Worktree:  $WORKTREE_ROOT"

# --- 1. .env.local をメインリポジトリからコピー ---
# .env.local は .gitignore 対象のため worktree に自動コピーされない
if [ -f "$MAIN_REPO/.env.local" ]; then
  cp "$MAIN_REPO/.env.local" "$WORKTREE_ROOT/.env.local"
  echo "✓ .env.local copied from main repo"
else
  echo "⚠ .env.local not found in main repo: $MAIN_REPO"
fi

# --- 2. mise trust ---
cd "$WORKTREE_ROOT"
mise trust
echo "✓ mise trust done"

# --- 3. bun install (グローバルキャッシュ活用 + frozen lockfile) ---
# グローバルキャッシュからハードリンクするため、2回目以降はほぼ一瞬
bun install --frozen-lockfile
echo "✓ bun install done"

echo ""
echo "=== Worktree setup complete ==="
