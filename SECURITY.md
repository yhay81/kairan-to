# Security

## Controls

- 128-bit notice ID、256-bit owner capability key、回答ごとの256-bit edit key
- D1に鍵のSHA-256 hashだけを保存し、定時間比較
- same-origin write、JSON content type、body size、文字数、期限範囲、列挙値を検証
- URL、メールアドレス、制御文字、honeypot入力を拒否
- 1回覧250回答、1匿名ブラウザ1回答、1匿名ブラウザ1日10回覧
- 3つの異なる匿名セッションから報告された回覧を自動非表示
- private routeの`noindex`/`no-store`、CSP、HSTS、nosniff、frame deny
- JSXとDOM `textContent`だけで利用者入力を表示
- CSVの表計算式注入を無効化
- scheduled cleanupで回覧、回答、匿名イベントを21日以内に削除

## Capability boundary

公開APIは回覧本文と読了・出欠の集計だけを返し、個別回答を返しません。管理APIだけがowner keyを受け入れ、呼び名とメモを返します。回答の上書きには回答ID、同じ匿名端末ID、edit keyのすべてが必要です。

管理URLを失うと復旧できません。回答URLと分けて安全な場所へ保管してください。

## Reporting

秘密鍵の漏えいや脆弱性は公開issueへ本文を貼らず、GitHub Security Advisoryのprivate reportを利用してください。
