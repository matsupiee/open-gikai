# =============================================================================
# 出力値 (Outputs)
# =============================================================================
# terraform apply 完了後にターミナルに表示される値。
# 他のスクリプトから terraform output -raw <名前> で取得することもできる。
# deploy-db.sh や upload-db.sh はこの仕組みで VM の IP やバケット名を取得している。

# VM の外部 IP アドレス。apps/web の LIBSQL_URL に設定する値の一部。
output "vm_external_ip" {
  description = "External IP address of the sqld server"
  value       = google_compute_instance.sqld_server.network_interface[0].access_config[0].nat_ip
}

# GCS バケット名。upload-db.sh がアップロード先を特定するのに使う。
output "gcs_bucket_name" {
  description = "GCS bucket name for SQLite files"
  value       = google_storage_bucket.minutes_db.name
}

# apps/web の環境変数 LIBSQL_URL に設定する完全な URL。
# terraform apply 後にこの値をコピーして Vercel 等の環境変数に貼り付ける。
output "libsql_url" {
  description = "LIBSQL_URL to set in apps/web environment"
  value       = "http://${google_compute_instance.sqld_server.network_interface[0].access_config[0].nat_ip}:${var.sqld_port}"
}

# VM に SSH 接続するためのコマンド。デバッグやログ確認に使う。
output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "gcloud compute ssh sqld-server --zone=${var.zone} --project=${var.project}"
}

# VM が配置されるゾーン。deploy-db.sh で SSH 接続に使う。
output "zone" {
  description = "GCP zone where the VM is located"
  value       = var.zone
}

# GCP プロジェクト ID。deploy-db.sh で SSH 接続に使う。
output "project" {
  description = "GCP project ID"
  value       = var.project
}
