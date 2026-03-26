#!/bin/bash
set -euo pipefail

SQLD_VERSION="v0.24.32"
SQLD_BIN="/usr/local/bin/sqld"
DATA_DIR="/var/lib/sqld"
DB_PATH="${DATA_DIR}/data.db"
METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
METADATA_HEADER="Metadata-Flavor: Google"

# --- Read metadata ---
AUTH_TOKEN=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/sqld-auth-token")
GCS_BUCKET=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/gcs-bucket")
DB_FILENAME=$(curl -sf -H "${METADATA_HEADER}" "${METADATA_URL}/db-filename")

# --- Install sqld ---
if [ ! -f "${SQLD_BIN}" ]; then
  echo "Installing sqld ${SQLD_VERSION}..."
  apt-get update -qq && apt-get install -y -qq curl xz-utils
  DOWNLOAD_URL="https://github.com/tursodatabase/libsql/releases/download/libsql-server-${SQLD_VERSION}/libsql-server-x86_64-unknown-linux-gnu.tar.xz"
  curl -fsSL "${DOWNLOAD_URL}" -o /tmp/sqld.tar.xz
  tar -xJf /tmp/sqld.tar.xz -C /tmp
  mv /tmp/sqld "${SQLD_BIN}"
  chmod +x "${SQLD_BIN}"
  rm -f /tmp/sqld.tar.xz
  echo "sqld installed."
fi

# --- Create sqld user ---
if ! id -u sqld &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin sqld
fi

# --- Create data directory ---
mkdir -p "${DATA_DIR}"

# --- Download DB from GCS ---
if [ ! -f "${DB_PATH}" ] || [ -f "${DATA_DIR}/.refresh" ]; then
  echo "Downloading database from gs://${GCS_BUCKET}/${DB_FILENAME}..."
  gsutil -o "GSUtil:parallel_composite_upload_threshold=150M" cp "gs://${GCS_BUCKET}/${DB_FILENAME}" "${DB_PATH}"
  rm -f "${DATA_DIR}/.refresh"
  echo "Database downloaded."
fi

chown -R sqld:sqld "${DATA_DIR}"

# --- Configure systemd ---
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
Environment=SQLD_AUTH_TOKEN=Bearer:${AUTH_TOKEN}
Environment=RUST_LOG=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sqld
systemctl restart sqld

echo "sqld is running."
