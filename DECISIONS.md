# Decisions

## 2026-07-30 — One-notice circulation

- Decision: 継続的な自治会アプリを作らず、一つの回覧の読了または行事の出欠だけを扱う
- Reason: 広い会員・通知機能と競わず、既存のLINEやメールへ一つのURLを流す短期ジョブを改善する
- Boundary: 名簿、通知、ファイル、写真、会費、役割、チャット、防災・安否確認を扱わない

## 2026-07-30 — Visual progress, aggregate public view

- Decision: 中央の回覧と周囲の家の灯りで読了進捗を示す
- Decision: 回答URLは集計だけ、呼び名とメモは管理URLだけに表示する
- Reason: 説明文を読まなくても一周までの状態が分かり、共有URLが転送されても個別世帯情報を露出しない
- Input guidance: 本名や住所ではなく、班番号や共有済みの世帯別名を求める

## 2026-07-30 — Capability URLs, no Better Auth

- Decision: Better Authを導入せず、回覧ごとの管理鍵と回答ごとの編集鍵を発行する
- Reason: 一回覧の利用に登録を要求せず、アカウント復旧や本人情報保有を避ける
- Boundary: 鍵はhash化して保存し、管理鍵はURL fragmentからBearerへ渡す

## 2026-07-30 — Short retention and canonical delivery

- Decision: 回覧、回答、匿名イベントを21日以内に削除する
- Decision: 正規URLを`https://kairan-to.yhay81.com`とし、`workers.dev`とpreview URLを無効にする
- Reason: 回覧後に履歴を残す必要はなく、運用責任と共有先を小さく保てる
