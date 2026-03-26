# =============================================================================
# 変数定義
# =============================================================================
# Terraform の variable は、他の .tf ファイルから var.xxx で参照できるパラメータ。
# 実際の値は terraform.tfvars ファイルで上書きする（terraform.tfvars は .gitignore 済み）。
# default が設定されている変数は、tfvars で指定しなければ default 値が使われる。

# --- GCP プロジェクト設定 ---

variable "project" {
  description = "GCP project ID"
  type        = string
  default     = "company-research-459805"
}

# リージョン = データセンターの地域。us-central1 はアメリカ中部（アイオワ）。
# 東京 (asia-northeast1) より安いのでこちらを選択。
variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

# ゾーン = リージョン内の具体的な施設。リージョン名 + a/b/c のいずれか。
variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

# --- VM 設定 ---

# マシンタイプ = VM のスペック。e2-medium は 2 vCPU / 4GB RAM。
# SQLite の読み取り専用サーバーには十分。
variable "machine_type" {
  description = "GCE instance machine type"
  type        = string
  default     = "e2-medium"
}

# ブートディスクのサイズ。SQLite ファイルが 200GB 超なので余裕をもって 300GB。
variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 300
}

# --- sqld 設定 ---

# sqld が HTTP リクエストを受け付けるポート番号。
variable "sqld_port" {
  description = "Port for sqld HTTP listener"
  type        = number
  default     = 8080
}

# sqld への認証トークン。apps/web の LIBSQL_AUTH_TOKEN と同じ値を設定する。
# sensitive = true にすると terraform plan/apply の出力でマスクされる。
variable "sqld_auth_token" {
  description = "Bearer token for sqld authentication"
  type        = string
  sensitive   = true
}

# --- GCS 設定 ---

# SQLite ファイルを保管する GCS バケットの名前。
# バケット名はグローバルで一意である必要がある。
variable "gcs_bucket_name" {
  description = "GCS bucket name for SQLite file storage"
  type        = string
  default     = "open-gikai-minutes-db"
}

# GCS 上の SQLite ファイル名。
variable "db_filename" {
  description = "SQLite database filename in GCS"
  type        = string
  default     = "minutes.db"
}
