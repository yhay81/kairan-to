# 回覧灯

一件の回覧を登録なしで共有し、読んだ世帯を灯りの輪で確かめる日本語Webサービスです。

- サービス: <https://kairan-to.yhay81.com>
- 使い方: <https://kairan-to.yhay81.com/guide>
- プライバシー: <https://kairan-to.yhay81.com/privacy>

## Product boundary

役員は発信元、件名、本文、期限、目安世帯数と、読了だけか行事の出欠かを入力し、回答URLと管理URLを受け取ります。回答URLは本文と集計だけを表示し、世帯の呼び名・班番号と任意メモは管理鍵を持つ役員だけが確認できます。

継続的な自治会運営、会員名簿、通知、ファイル、写真、会費、チャット、防災・安否確認は扱いません。回覧、回答、匿名操作イベントは21日後に削除します。

## Development

Node.js 24 LTSとnpmを使います。

```powershell
npm ci
npx wrangler d1 migrations apply kairan-to --local
npm run dev -- --host 127.0.0.1 --port 5174
```

検査:

```powershell
npm run release:check
npm run check
npm test
npm run build
npm audit --omit=dev
```

本番:

```powershell
npx wrangler d1 migrations apply kairan-to --remote
npm run deploy
npm run indexnow
npm run metrics
```

## Stack

Cloudflare Workers / D1、Hono JSX、Vite+、TypeScript。Better Authは使わず、回覧ごとの256-bit owner capability keyと回答ごとの256-bit edit keyで権限を分離します。
