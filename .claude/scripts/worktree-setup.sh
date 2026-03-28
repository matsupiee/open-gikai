#!/usr/bin/env bash

# WorktreeCreate hook: デフォルトの git worktree add を置き換える
# stdin から JSON を受け取り、worktree を作成してセットアップする
# 最後に worktree の絶対パスを stdout に出力する（必須）
#
# 注意: set -e は使わない。各ステップの失敗がスクリプト全体を中断させると
# worktree パスが stdout に出力されず、Claude Code がフォールバック動作になる。

# --- 0. mise でツールチェインを有効化 ---
export PATH="$HOME/.local/bin:$PATH"
eval "$(mise activate bash --shims 2>/dev/null)" || true

# --- 1. stdin から worktree 名を取得し、worktree を作成 ---
NAME=$(jq -r .name)
DIR="$CLAUDE_PROJECT_DIR/.claude/worktrees/$NAME"

if ! git worktree add "$DIR" HEAD >&2; then
  echo "✗ git worktree add failed" >&2
  exit 1
fi
echo "Worktree created: $DIR" >&2

# --- ここから先は worktree 作成済み。失敗してもパス出力は保証する ---

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

# --- 3. mise trust & install ---
cd "$DIR" || true
if command -v mise &>/dev/null; then
  mise trust >&2 || echo "⚠ mise trust failed" >&2
  mise install >&2 || echo "⚠ mise install failed" >&2
  echo "✓ mise setup done" >&2
else
  echo "⚠ mise not found, skipping mise setup" >&2
fi

# --- 4. bun install ---
if command -v bun &>/dev/null; then
  if bun install >&2; then
    echo "✓ bun install done" >&2
  else
    echo "✗ bun install failed (exit $?)" >&2
  fi
else
  echo "⚠ bun not found, skipping bun install" >&2
fi

echo "" >&2
echo "=== Worktree setup complete ===" >&2

# 最後に worktree パスを stdout に出力（必須）
echo "$DIR"
