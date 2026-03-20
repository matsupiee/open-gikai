#!/usr/bin/env bash
set -euo pipefail

# --- 0. PATH にツールを追加 ---
# hook はログインシェルではないため mise / bun が PATH にない場合がある
export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$HOME/.bun/bin:$PATH"

# mise が activate 済みならその shims も追加
if command -v mise &>/dev/null; then
  eval "$(mise env 2>/dev/null)" || true
fi

WORKTREE_ROOT="$(pwd)"

# メインリポジトリのパスを取得
MAIN_REPO=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
echo "Main repo: $MAIN_REPO" >&2
echo "Worktree:  $WORKTREE_ROOT" >&2

# --- 1. .env.local をメインリポジトリからコピー ---
# .env.local は .gitignore 対象のため worktree に自動コピーされない
if [ -f "$MAIN_REPO/.env.local" ]; then
  cp "$MAIN_REPO/.env.local" "$WORKTREE_ROOT/.env.local"
  echo "✓ .env.local copied from main repo" >&2
else
  echo "⚠ .env.local not found in main repo: $MAIN_REPO" >&2
fi

# --- 2. mise trust ---
cd "$WORKTREE_ROOT"
if command -v mise &>/dev/null; then
  mise trust
  echo "✓ mise trust done" >&2
else
  echo "⚠ mise not found, skipping mise trust" >&2
fi

# --- 3. bun install (グローバルキャッシュ活用 + frozen lockfile) ---
# グローバルキャッシュからハードリンクするため、2回目以降はほぼ一瞬
if command -v bun &>/dev/null; then
  bun install --frozen-lockfile
  echo "✓ bun install done" >&2
else
  echo "⚠ bun not found, skipping bun install" >&2
fi

echo "" >&2
echo "=== Worktree setup complete ===" >&2
