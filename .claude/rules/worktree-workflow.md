# Worktree ワークフロー

## worktree 作業時は PR 作成まで自動で行う (CRITICAL)

worktree で作業している場合（ブランチ名が `worktree-` で始まる、または `.claude/worktrees/` 配下にいる場合）、実装が完了したらコミット → プッシュ → PR 作成まで一連で実行する。

ユーザーに「PR も作って」と都度確認する必要はない。

## worktree 作業時の注意事項 (CRITICAL)

### 1. cwd は常に絶対パスで管理する

`cd` でサブディレクトリに移動すると以降のコマンドに影響する。Bash ツールでは **絶対パスを使う** か、コマンドごとに worktree ルートに戻ること。

```bash
# ✅ 絶対パスを使う
bun run --cwd /path/to/worktree/apps/scraper-worker test

# ❌ cd したまま次のコマンドを実行しない
cd apps/scraper-worker && bun test
# → 以降のコマンドが apps/scraper-worker 基準になってしまう
```

### 2. workspace パッケージの解決

`bun install` 後、ワークスペースパッケージ（`@open-gikai/db` 等）がルートの `node_modules/` にリンクされない場合がある。スクリプト実行時に `Cannot find module` が出たら、**該当 app のディレクトリから実行する**。

```bash
# ✅ app ディレクトリから実行
cd /path/to/worktree/apps/scraper-worker && bun run src/index.ts

# ❌ ルートから実行すると workspace リンクが見つからないことがある
cd /path/to/worktree && bun run apps/scraper-worker/src/index.ts
```

### 3. .claude/ ディレクトリは worktree 間で共有される

`.claude/` は git の共有ディレクトリ（メインリポジトリの実体）を参照するため、worktree 側で `.claude/skills/` 等を変更しても **worktree の `git status` には表示されない**。

`.claude/` 配下のファイルをコミットする必要がある場合は、**メインリポジトリ側で別ブランチを切ってコミットする**。
