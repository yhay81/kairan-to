# 回覧灯 public pilot

## Decision

- Status: 30-day public pilot
- Review deadline: 2026-08-29
- Investment decision: hold
- Target: LINEやメールで紙の回覧代替を試す、日本語の小規模な町内会・自治会役員
- Existing alternatives: いちのいち、結ネット、自治会サポ！、LINE、Googleフォーム

広い自治会運営機能を再現せず、「登録なし・一回覧だけ・公開は集計だけ・21日で消える」という狭い入口に実需要があるかを確かめます。

## Falsifiable outcome

- Continue: 実役員3人以上、実回覧5件以上、読了50件以上、10読了以上の回覧3件以上、2回覧以上を作った役員2人以上
- Hold: 30日後も実回覧2件未満、または読了10件未満
- Stop/reshape: 通知、会員名簿、防災・安否確認がなければ価値が成立しない
- Automated QA、自己テスト、訪問だけのセッションは実利用に数えない

獲得は検索、Tool Shelf、役員自身による既存組織内への自然なURL共有に限定します。許可のないDM、メール、SNS投稿は行いません。

## Safety boundary

- 回答URLでは回覧本文と集計だけを返し、個別の呼び名とメモを返さない
- 管理鍵と回答編集鍵はhash化し、管理鍵はURL fragmentからBearerへ渡す
- 氏名、住所、電話番号、メール、位置情報、写真を求めない
- 1回覧250回答、1端末1回答、1端末1日10回覧
- 3つの異なる匿名セッションから報告された回覧を非表示にする
- 通知や到達保証を持たず、緊急連絡・安全確認には使わない
