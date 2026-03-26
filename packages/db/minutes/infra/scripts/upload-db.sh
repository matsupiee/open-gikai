#!/bin/bash
# =============================================================================
# DB アップロードスクリプト
# =============================================================================
# ローカルで生成した SQLite ファイルを GCS バケットにアップロードする。
# アップロード先のバケット名は terraform output から自動で取得する。
#
# 使い方:
#   ./upload-db.sh /path/to/minutes.db
#
# 前提条件:
#   - gcloud CLI がインストール済みで認証済み (gcloud auth login)
#   - terraform apply が完了済み（バケットが作成されていること）

set -euo pipefail

# このスクリプト自身のディレクトリから terraform ディレクトリの相対パスを計算
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# 第1引数: アップロードする DB ファイルのパス（必須）
DB_PATH="${1:-}"
if [ -z "${DB_PATH}" ]; then
  echo "Usage: $0 <path-to-minutes.db>"
  exit 1
fi

# ファイルの存在チェック
if [ ! -f "${DB_PATH}" ]; then
  echo "Error: File not found: ${DB_PATH}"
  exit 1
fi

# terraform output からバケット名を取得。
# outputs.tf で定義した gcs_bucket_name の値が返る。
BUCKET=$(cd "${TERRAFORM_DIR}" && terraform output -raw gcs_bucket_name)

# ファイルサイズを表示（確認用）
DB_SIZE=$(du -h "${DB_PATH}" | cut -f1)

echo "Uploading ${DB_PATH} (${DB_SIZE}) to gs://${BUCKET}/minutes.db ..."
# gsutil cp で GCS にアップロード。
# parallel_composite_upload_threshold: 150MB 以上のファイルを並列分割アップロードして高速化する。
gsutil -o "GSUtil:parallel_composite_upload_threshold=150M" cp "${DB_PATH}" "gs://${BUCKET}/minutes.db"

echo "Upload complete."
