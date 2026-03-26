# =============================================================================
# GCE 仮想マシン (VM)
# =============================================================================
# sqld (libSQL サーバー) を動かす VM を1台作成する。
# VM が起動すると metadata の startup-script が自動実行され、
# sqld のインストール → GCS から DB ダウンロード → systemd でサービス起動 まで行う。

resource "google_compute_instance" "sqld_server" {
  name         = "sqld-server"
  machine_type = var.machine_type # e2-medium (2 vCPU / 4GB RAM)
  zone         = var.zone         # us-central1-a

  # tags: ファイアウォールルールの適用対象を絞り込むためのラベル。
  # network.tf の firewall ルールが "sqld-server" タグを持つ VM にだけ適用される。
  tags = ["sqld-server"]

  # labels: GCP コンソールでリソースを分類・検索するためのメタデータ。
  labels = { app = "open-gikai", component = "sqld" }

  # ブートディスク: VM の OS とデータを格納するストレージ。
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12" # Debian 12 (Bookworm) の公式イメージ
      size  = var.disk_size_gb         # 300GB (SQLite 200GB+ を格納するため)
      type  = "pd-ssd"                 # SSD ディスク。検索クエリの読み取り速度に直結する。
    }
  }

  # ネットワーク設定: default VPC に接続し、外部 IP を割り当てる。
  network_interface {
    network = "default"
    # access_config を空で指定すると、エフェメラル（一時的）な外部 IP が自動で割り当てられる。
    # VM を削除・再作成しない限り IP は変わらない。固定 IP より月 $3 ほど安い。
    access_config {}
  }

  # metadata: VM に渡す設定値。VM 内から metadata サーバー経由で読み取れる。
  metadata = {
    # startup-script: VM 起動時に自動実行されるシェルスクリプト。
    # file() は Terraform の関数で、ローカルファイルの内容を文字列として読み込む。
    startup-script = file("${path.module}/../scripts/startup.sh")

    # 以下の値は startup.sh 内で metadata サーバーから取得して使う。
    sqld-auth-token = var.sqld_auth_token # sqld の認証トークン
    gcs-bucket      = var.gcs_bucket_name # DB ファイルがある GCS バケット名
    db-filename     = var.db_filename     # GCS 上の DB ファイル名
  }

  # サービスアカウント: VM が GCP API を呼ぶ際の権限。
  # storage-ro = GCS からの読み取りのみ許可（DB ファイルのダウンロード用）。
  service_account {
    scopes = ["storage-ro"]
  }
}
