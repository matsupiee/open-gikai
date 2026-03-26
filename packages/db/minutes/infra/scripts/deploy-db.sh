#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

ZONE=$(cd "${TERRAFORM_DIR}" && terraform output -raw ssh_command | grep -oP '(?<=--zone=)\S+')
PROJECT=$(cd "${TERRAFORM_DIR}" && terraform output -raw ssh_command | grep -oP '(?<=--project=)\S+')
VM_IP=$(cd "${TERRAFORM_DIR}" && terraform output -raw vm_external_ip)
BUCKET=$(cd "${TERRAFORM_DIR}" && terraform output -raw gcs_bucket_name)

echo "Deploying database to sqld-server..."

gcloud compute ssh sqld-server \
  --zone="${ZONE}" \
  --project="${PROJECT}" \
  --command="
    sudo systemctl stop sqld
    sudo -u sqld gsutil cp gs://${BUCKET}/minutes.db /var/lib/sqld/data.db
    sudo systemctl start sqld
  "

echo "Waiting for sqld to start..."
sleep 3

HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://${VM_IP}:8080/health" || echo "000")
if [ "${HTTP_STATUS}" = "200" ]; then
  echo "sqld is healthy. Deploy complete."
else
  echo "Warning: Health check returned ${HTTP_STATUS}. Check VM logs with:"
  echo "  gcloud compute ssh sqld-server --zone=${ZONE} --project=${PROJECT} --command='sudo journalctl -u sqld -n 50'"
fi
