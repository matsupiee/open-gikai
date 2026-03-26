terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment to migrate state to GCS:
  # backend "gcs" {
  #   bucket = "open-gikai-tfstate"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project
  region  = var.region
}
