#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

DB_PATH="${1:-}"
if [ -z "${DB_PATH}" ]; then
  echo "Usage: $0 <path-to-minutes.db>"
  exit 1
fi

if [ ! -f "${DB_PATH}" ]; then
  echo "Error: File not found: ${DB_PATH}"
  exit 1
fi

BUCKET=$(cd "${TERRAFORM_DIR}" && terraform output -raw gcs_bucket_name)
DB_SIZE=$(du -h "${DB_PATH}" | cut -f1)

echo "Uploading ${DB_PATH} (${DB_SIZE}) to gs://${BUCKET}/minutes.db ..."
gsutil -o "GSUtil:parallel_composite_upload_threshold=150M" cp "${DB_PATH}" "gs://${BUCKET}/minutes.db"

echo "Upload complete."
