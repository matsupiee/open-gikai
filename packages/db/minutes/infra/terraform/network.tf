resource "google_compute_firewall" "allow_sqld" {
  name    = "allow-sqld"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = [tostring(var.sqld_port)]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["sqld-server"]
}
