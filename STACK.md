# Stack

- Runtime: Cloudflare Workers
- API / rendering: Hono / Hono JSX
- Build and quality: Vite+ / TypeScript / Oxlint / Oxfmt / Vitest
- Persistence: Cloudflare D1
- Delivery: `kairan-to.yhay81.com` custom domain; `workers.dev` and preview URLs disabled
- Authentication: Better Authなし。回覧単位のowner capability keyと回答単位のedit key

アカウント、メール、Cookieを不要にできる単発回覧の境界なので、Better Authは導入しません。継続的な会員管理や請求が必要になった場合に再評価します。
