# Metrics

回覧と回答の業務行を正本にし、訪問、URLコピー、管理画面表示、別日再訪だけを匿名イベントで補います。自動QAは`?qa=1`、WebDriver、`x-automated-qa`で除外します。

| Metric                   | Source                      | Meaning                  |
| ------------------------ | --------------------------- | ------------------------ |
| `users`                  | distinct `visited` session  | 匿名訪問者               |
| `organizers`             | distinct notice creator     | 回覧を作った匿名役員     |
| `notices_created`        | visible `notices`           | 作成された実回覧         |
| `links_copied`           | distinct notice context     | 回答URLをコピーした回覧  |
| `reads_saved`            | `acknowledgements`          | 現在保存されている読了   |
| `respondents`            | distinct response session   | 回答した匿名端末         |
| `notices_with_reads`     | acknowledgement aggregation | 1件以上読了がある回覧    |
| `notices_with_ten_reads` | acknowledgement aggregation | 10件以上読了がある回覧   |
| `attendance_notices`     | `notices.response_mode`     | 出欠回答を使った回覧     |
| `notices_completed`      | reads >= expected count     | 目安世帯数を一周した回覧 |
| `notices_closed`         | `notices.status`            | 役員が締め切った回覧     |
| `repeat_organizers`      | creator aggregation         | 2回覧以上作った匿名役員  |
| `returned`               | distinct `returned` session | 別日に再訪した匿名利用者 |

回覧内容、呼び名、メモ、IPアドレス、User-Agentは操作イベントへ記録しません。ブラウザ生成UUID、操作名、回覧IDまたは`home`、発生日だけを21日以内保存します。
