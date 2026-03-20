# Worktree ワークフロー

## worktree 作業時は PR 作成まで自動で行う (CRITICAL)

worktree で作業している場合（ブランチ名が `worktree-` で始まる、または `.claude/worktrees/` 配下にいる場合）、実装が完了したらコミット → プッシュ → PR 作成まで一連で実行する。

ユーザーに「PR も作って」と都度確認する必要はない。
