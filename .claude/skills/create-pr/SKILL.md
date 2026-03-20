---
name: create-pr
description: 変更内容からブランチ作成・コミット・PR作成までを一括で行う
version: 1.0.0
---

# Create PR

作業中の変更から GitHub Pull Request を作成するスキル。

## 手順

### 1. 状態確認

以下を**並列**で実行して現在の状態を把握する:

```bash
git status
git diff --stat
git log --oneline -5
```

- 変更がない場合はユーザーに通知して終了
- コミット済みだがプッシュされていないコミットがある場合はそれも PR に含める

### 2. ブランチ作成

- 現在 main ブランチにいる場合は、変更内容に基づいてブランチを作成する
  - 命名規則: `feat/xxx`, `fix/xxx`, `refactor/xxx`, `chore/xxx`
  - 日本語は使わず、英語のケバブケースで命名する
- 既にフィーチャーブランチにいる場合はそのまま使用する

### 3. テスト実行

コミット前に**必ず**テストを実行する:

```bash
bun run test
```

- テストが失敗した場合はコミットせず、ユーザーに報告する
- テストファイルが存在しない場合はスキップ可

### 4. コミット

- `git add` で関連ファイルのみをステージングする（`git add .` は避ける）
- `.env`, `credentials.json` などの機密ファイルは絶対にコミットしない
- コミットメッセージは以下の形式:

```
<type>: <日本語で変更の要約>

<必要に応じて詳細を記載>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

- `type` は `feat`, `fix`, `refactor`, `chore`, `docs`, `test` のいずれか
- 要約は日本語で簡潔に書く

### 5. プッシュ & PR 作成

```bash
git push -u origin <branch-name>
```

PR は `gh pr create` で作成する。本文は `.github/pull_request_template.md` のテンプレートに従う:

```bash
gh pr create --title "<type>: <日本語タイトル>" --body "$(cat <<'EOF'
## Summary

- 変更の概要を箇条書きで記載

## Why

なぜこの変更が必要か

## What Changed

- 主要な変更点をファイル/モジュール単位で記載

## Test Plan

- [x] 実施済みのテスト
- [ ] 追加で必要なテスト

## Notes

レビュアーへの補足（なければ省略）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 6. 完了報告

PR の URL をユーザーに表示する。

## ルール

- PR タイトルは 70 文字以内に収める
- `--force` push は絶対にしない
- main ブランチに直接コミットしない（必ずフィーチャーブランチを使う）
- コミット前のテスト実行は必須（スキップしない）
- 1 つの PR に無関係な変更を混ぜない
