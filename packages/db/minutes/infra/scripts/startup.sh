#!/bin/bash
# =============================================================================
# VM 起動スクリプト (startup script)
# =============================================================================
# GCE VM が起動するたびに自動実行されるスクリプト。
# Terraform の vm.tf で metadata.startup-script として登録している。
#
# やること:
#   1. sqld (libSQL サーバー) のバイナリをインストール
#   2. GCS から SQLite ファイルをダウンロード
#   3. systemd サービスとして sqld を起動
#
# このスクリプトは冪等（何回実行しても同じ結果になる）に作られているため、
# VM の再起動時にも安全に動作する。

# set -e: コマンドがエラーになったら即座に停止
# set -u: 未定義の変数を参照したらエラー
# set -o pipefail: パイプの途中でエラーが起きたら検知する
set -euo pipefail

# --- 定数定義 ---
SQLD_VERSION="v0.24.32"                    # インストールする sqld のバージョン
SQLD_BIN="/usr/local/bin/sqld"             # sqld バイナリの配置先
DATA_DIR="/var/lib/sqld"                   # SQLite ファイルの格納ディレクトリ
DB_PATH="${DATA_DIR}/data.db"              # sqld が読み込む DB ファイルのパス

# GCE の metadata サーバー。VM 内からのみアクセスでき、Terraform で設定した値を取得できる。
# vm.tf の metadata ブロックで設定した sqld-auth-token, gcs-bucket, db-filename をここから読む。
METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
METADATA_HEADER="Metadata-Flavor: Google"

# --- metadata サーバーから設定値を取得 ---
AUTH_TOKEN=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/sqld-auth-token")
GCS_BUCKET=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/gcs-bucket")
DB_FILENAME=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/db-filename")

# --- sqld のインストール ---
# バイナリが存在しない場合のみインストールする（冪等性のため）。
if [ ! -f "${SQLD_BIN}" ]; then
  echo "Installing sqld ${SQLD_VERSION}..."
  apt-get update -qq && apt-get install -y -qq curl xz-utils
  # GitHub Releases から Linux 用のビルド済みバイナリをダウンロード
  DOWNLOAD_URL="https://github.com/tursodatabase/libsql/releases/download/libsql-server-${SQLD_VERSION}/libsql-server-x86_64-unknown-linux-gnu.tar.xz"
  curl -fsSL "${DOWNLOAD_URL}" -o /tmp/sqld.tar.xz
  tar -xJf /tmp/sqld.tar.xz -C /tmp       # .tar.xz を展開
  mv /tmp/sqld "${SQLD_BIN}"               # バイナリを /usr/local/bin/ に配置
  chmod +x "${SQLD_BIN}"
  rm -f /tmp/sqld.tar.xz
  echo "sqld installed."
fi

# --- sqld 専用ユーザーの作成 ---
# セキュリティのため、sqld を root ではなく専用ユーザーで実行する。
# --system: システムユーザー（ログイン不可）として作成。
if ! id -u sqld &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin sqld
fi

# --- データディレクトリの作成 ---
mkdir -p "${DATA_DIR}"

# --- GCS から SQLite ファイルをダウンロード ---
# 以下のどちらかの条件を満たす場合にダウンロードする:
#   - DB ファイルがまだ存在しない（初回起動時）
#   - .refresh フラグファイルが存在する（deploy-db.sh による更新トリガー）
if [ ! -f "${DB_PATH}" ] || [ -f "${DATA_DIR}/.refresh" ]; then
  echo "Downloading database from gs://${GCS_BUCKET}/${DB_FILENAME}..."
  gsutil -o "GSUtil:parallel_composite_upload_threshold=150M" cp "gs://${GCS_BUCKET}/${DB_FILENAME}" "${DB_PATH}"
  rm -f "${DATA_DIR}/.refresh"  # フラグファイルを削除（次回起動時に再ダウンロードしないように）
  echo "Database downloaded."
fi

# DB ファイルの所有者を sqld ユーザーに変更（sqld がファイルを読めるようにする）
chown -R sqld:sqld "${DATA_DIR}"

# --- systemd サービスの設定 ---
# sqld を systemd で管理することで、自動起動・クラッシュ時の自動再起動が可能になる。
# /etc/systemd/system/ にユニットファイルを書き出す。
cat > /etc/systemd/system/sqld.service <<EOF
[Unit]
Description=sqld - libSQL server
After=network.target

[Service]
Type=simple
User=sqld
ExecStart=${SQLD_BIN} \\
  --db-path ${DB_PATH} \\
  --http-listen-addr 0.0.0.0:8080
# 注意: sqld には --read-only フラグがない。
# 書き込みリクエストが来た場合は SQLite レベルでエラーになるが、
# 本構成では apps/web が読み取りクエリのみ発行するため問題ない。
# SQLD_HTTP_AUTH: basic:<base64> の形式で設定。
# sqld の HTTP 認証は Basic 認証方式を使う。
# apps/web の @libsql/client は authToken をそのまま Authorization ヘッダーに送るため、
# クライアント側の設定と合わせる必要がある。
Environment=SQLD_HTTP_AUTH=basic:${AUTH_TOKEN}
Environment=RUST_LOG=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# systemd にユニットファイルの変更を反映 → 自動起動を有効化 → 起動（または再起動）
systemctl daemon-reload
systemctl enable sqld
systemctl restart sqld

echo "sqld is running."
