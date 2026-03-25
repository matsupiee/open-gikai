declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE: Hyperdrive;
    CORS_ORIGIN: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    /** dbjson ディレクトリのパス（manifest.json とシャード SQLite を格納） */
    MINUTES_DB_DIR: string;
  }
}
