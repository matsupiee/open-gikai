declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE: Hyperdrive;
    CORS_ORIGIN: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    /** libSQL の接続 URL（dev: file:// / prod: libsql://） */
    LIBSQL_URL: string;
    /** libSQL の認証トークン（prod のみ必須） */
    LIBSQL_AUTH_TOKEN: string;
  }
}
