# =============================================================================
# ファイアウォールルール
# =============================================================================
# GCE VM へのネットワークアクセスを制御する。
# デフォルトではすべての外部からの通信がブロックされるため、
# sqld のポート (8080) を明示的に開放する必要がある。

resource "google_compute_firewall" "allow_sqld" {
  name    = "allow-sqld"
  network = "default" # GCP プロジェクトのデフォルト VPC ネットワーク

  # 許可する通信: TCP の 8080 番ポート（sqld の HTTP リスナー）。
  allow {
    protocol = "tcp"
    ports    = [tostring(var.sqld_port)]
  }

  # source_ranges: どこからのアクセスを許可するか。
  # "0.0.0.0/0" = インターネット上のすべての IP からアクセス可能。
  # sqld の認証トークン (Bearer token) でアクセス制御を行うため、IP 制限はしていない。
  source_ranges = ["0.0.0.0/0"]

  # target_tags: このルールを適用する VM を絞り込む。
  # vm.tf で tags = ["sqld-server"] を設定した VM にだけ適用される。
  target_tags = ["sqld-server"]
}
