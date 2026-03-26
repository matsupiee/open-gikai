# =============================================================================
# GCS バケット (Google Cloud Storage)
# =============================================================================
# SQLite ファイルの受け渡しに使うストレージバケット。
# ローカルで生成した DB ファイルをここにアップロードし、VM がダウンロードする。
#
# 流れ: ローカル → (upload-db.sh) → GCS バケット → (deploy-db.sh) → VM

resource "google_storage_bucket" "minutes_db" {
  name     = var.gcs_bucket_name # バケット名（グローバルで一意）
  location = var.region          # VM と同じリージョンにすると転送が速い＆無料

  storage_class               = "STANDARD" # 標準ストレージ。頻繁にアクセスするデータ向け。
  uniform_bucket_level_access = true       # バケット単位でアクセス制御（推奨設定）。
  force_destroy               = false      # true にすると terraform destroy 時に中身ごと削除される。安全のため false。

  # ライフサイクルルール: 90日以上経過したファイルを自動削除する。
  # 古い DB ファイルが溜まってストレージ料金がかさむのを防ぐ。
  lifecycle_rule {
    condition {
      age = 90 # アップロードから90日経過したら
    }
    action {
      type = "Delete" # 自動削除
    }
  }
}
