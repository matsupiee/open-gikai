# =============================================================================
# Terraform の基本設定
# =============================================================================
# このファイルでは「どのクラウドを使うか」「どのプロジェクトにリソースを作るか」を定義する。
# terraform init を実行すると、ここで指定したプロバイダ (Google Cloud) のプラグインが
# 自動でダウンロードされる。

terraform {
  # Terraform CLI のバージョン制約。1.5 以上が必要。
  required_version = ">= 1.5"

  required_providers {
    # Google Cloud 用のプロバイダプラグイン。
    # hashicorp/google が公式で、~> 5.0 は「5.x の最新を使う」という意味。
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Terraform の「状態ファイル (tfstate)」の保存先。
  # デフォルトはローカルファイル。チームで共有する場合は GCS バックエンドに変更する。
  # Uncomment to migrate state to GCS:
  # backend "gcs" {
  #   bucket = "open-gikai-tfstate"
  #   prefix = "terraform/state"
  # }
}

# Google Cloud プロバイダの設定。
# ここで指定した project と region が、以降の全リソースのデフォルトになる。
provider "google" {
  project = var.project
  region  = var.region
}
