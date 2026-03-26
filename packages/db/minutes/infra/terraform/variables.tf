variable "project" {
  description = "GCP project ID"
  type        = string
  default     = "company-research-459805"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "GCE instance machine type"
  type        = string
  default     = "e2-medium"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 300
}

variable "sqld_port" {
  description = "Port for sqld HTTP listener"
  type        = number
  default     = 8080
}

variable "sqld_auth_token" {
  description = "Bearer token for sqld authentication"
  type        = string
  sensitive   = true
}

variable "gcs_bucket_name" {
  description = "GCS bucket name for SQLite file storage"
  type        = string
  default     = "open-gikai-minutes-db"
}

variable "db_filename" {
  description = "SQLite database filename in GCS"
  type        = string
  default     = "minutes.db"
}
