declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AUTH_SECRET?: string;
    OWNER_EMAIL?: string;
    OWNER_SETUP_CODE?: string;
    AUTH_ORIGIN?: string;
  }
}
