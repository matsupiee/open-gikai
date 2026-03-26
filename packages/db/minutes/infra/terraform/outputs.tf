output "vm_external_ip" {
  description = "External IP address of the sqld server"
  value       = google_compute_instance.sqld_server.network_interface[0].access_config[0].nat_ip
}

output "gcs_bucket_name" {
  description = "GCS bucket name for SQLite files"
  value       = google_storage_bucket.minutes_db.name
}

output "libsql_url" {
  description = "LIBSQL_URL to set in apps/web environment"
  value       = "http://${google_compute_instance.sqld_server.network_interface[0].access_config[0].nat_ip}:${var.sqld_port}"
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "gcloud compute ssh sqld-server --zone=${var.zone} --project=${var.project}"
}
