declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    // Optional passphrase secret. When set (via `wrangler secret put APP_PIN`),
    // the workspace requires this passphrase; when unset, it stays open.
    APP_PIN?: string;
  }
}
