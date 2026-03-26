resource "google_compute_instance" "sqld_server" {
  name         = "sqld-server"
  machine_type = var.machine_type
  zone         = var.zone

  tags   = ["sqld-server"]
  labels = { app = "open-gikai", component = "sqld" }

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {} # Ephemeral external IP
  }

  metadata = {
    startup-script  = file("${path.module}/../scripts/startup.sh")
    sqld-auth-token = var.sqld_auth_token
    gcs-bucket      = var.gcs_bucket_name
    db-filename     = var.db_filename
  }

  service_account {
    scopes = ["storage-ro"]
  }
}
