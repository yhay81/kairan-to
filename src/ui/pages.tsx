import { product } from "../config/product";
import { Layout } from "./layout";

const houses = [
  ["h1", "灯"],
  ["h2", "灯"],
  ["h3", "灯"],
  ["h4", "灯"],
  ["h5", "灯"],
  ["h6", "灯"],
  ["h7", "・"],
  ["h8", "・"],
] as const;

function LightRing({ compact = false, title = "" }: { compact?: boolean; title?: string }) {
  const centerTitle = title
    ? title.length > 14
      ? `${title.slice(0, 13)}…`
      : title
    : "夏まつりのお知らせ";
  return (
    <div class={compact ? "light-ring compact" : "light-ring"} aria-hidden="true">
      <div class="ring-line"></div>
      {houses.map(([position, label]) => (
        <span class={`house-light ${position}`} data-lit={label === "灯" ? "true" : "false"}>
          <i></i>
          <b>{label}</b>
        </span>
      ))}
      <div class="notice-center">
        <span>回覧</span>
        <strong>{centerTitle}</strong>
        <small>{title ? "回覧の進捗" : "8月10日まで"}</small>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <Layout>
      <section class="lantern-stage" aria-label="回覧灯の利用イメージ">
        <div class="stage-copy">
          <span class="eyebrow">ONE NOTICE / NO ACCOUNT</span>
          <p>一枚の回覧から、読んだ家の灯りが順に点きます。</p>
        </div>
        <LightRing />
        <aside class="stage-meter">
          <header>
            <span>READ</span>
            <strong>7 / 12</strong>
          </header>
          <div class="meter-track">
            <i></i>
          </div>
          <dl>
            <div>
              <dt>参加</dt>
              <dd>5</dd>
            </div>
            <div>
              <dt>未定</dt>
              <dd>2</dd>
            </div>
            <div>
              <dt>欠席</dt>
              <dd>0</dd>
            </div>
          </dl>
          <p>
            <span>●</span> あと5世帯です
          </p>
        </aside>
      </section>

      <section class="maker-shell" id="create">
        <div class="maker-intro">
          <span class="eyebrow">PASS IT AROUND</span>
          <h1>{product.headline}</h1>
          <p>LINEやメールに回答URLを一つ。アプリや住民名簿を増やさず、次の回覧だけを確かめます。</p>
          <ol>
            <li>
              <span>01</span>お知らせを一枚つくる
            </li>
            <li>
              <span>02</span>いつもの連絡先へ流す
            </li>
            <li>
              <span>03</span>読了と出欠を灯りで見る
            </li>
          </ol>
        </div>
        <form class="maker" id="create-form">
          <header>
            <span class="paper-icon" aria-hidden="true">
              <i></i>
            </span>
            <div>
              <small>NEW NOTICE</small>
              <h2>次の回覧をつくる</h2>
            </div>
          </header>
          <label class="field">
            <span>
              発信元 <small>任意</small>
            </span>
            <input id="sender" maxlength={40} placeholder="ひだまり町内会" />
          </label>
          <label class="field">
            <span>回覧の件名</span>
            <input id="title" maxlength={60} placeholder="夏まつり準備のお知らせ" required />
          </label>
          <label class="field">
            <span>本文</span>
            <textarea
              id="body"
              maxlength={800}
              placeholder="集合日時、場所、持ち物などを簡潔に書いてください。"
              rows={6}
              required
            ></textarea>
          </label>
          <div class="field-pair">
            <label class="field">
              <span>回答</span>
              <select id="response-mode">
                <option value="read">読みました</option>
                <option value="attendance">行事の出欠</option>
              </select>
            </label>
            <label class="field">
              <span>目安の世帯数</span>
              <input id="expected-count" max={200} min={1} required type="number" value={12} />
            </label>
          </div>
          <label class="field">
            <span>回答期限</span>
            <input id="deadline" required type="date" />
          </label>
          <label class="honeypot" aria-hidden="true">
            Website
            <input id="website" tabindex={-1} />
          </label>
          <button class="button primary" id="create-button" type="submit">
            回答URLをつくる <span aria-hidden="true">→</span>
          </button>
          <p class="action-status" id="create-status" aria-live="polite"></p>
        </form>
      </section>
      <script src="/home.js?v=1" type="module"></script>
    </Layout>
  );
}

function SummaryTiles() {
  return (
    <div class="summary-tiles">
      <article class="read-tile">
        <small>読了</small>
        <strong>
          <span id="read-count">0</span>
          <em>世帯</em>
        </strong>
      </article>
      <article class="attendance-tile">
        <span class="status-dot yes"></span>
        <small>参加</small>
        <strong id="yes-count">0</strong>
      </article>
      <article class="attendance-tile">
        <span class="status-dot maybe"></span>
        <small>未定</small>
        <strong id="maybe-count">0</strong>
      </article>
      <article class="attendance-tile">
        <span class="status-dot no"></span>
        <small>欠席</small>
        <strong id="no-count">0</strong>
      </article>
    </div>
  );
}

export function NoticePage({ noticeId, title }: { noticeId: string; title: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/n/${noticeId}`}
      noindex
      title={`${title} | ${product.name}`}
    >
      <section class="notice-shell" data-notice-id={noticeId} id="notice-app">
        <header class="notice-heading">
          <div>
            <span class="eyebrow" id="notice-sender">
              回覧
            </span>
            <h1 id="notice-title">{title}</h1>
          </div>
          <span class="state-pill" id="notice-state">
            回答受付中
          </span>
        </header>
        <div class="notice-grid">
          <section class="notice-paper">
            <header>
              <span>回 覧</span>
              <small id="notice-deadline">--まで</small>
            </header>
            <p id="notice-body">読み込んでいます。</p>
            <footer>
              <span>大切な連絡や個人情報は載せないでください。</span>
            </footer>
          </section>
          <aside class="progress-panel">
            <LightRing compact title={title} />
            <div class="progress-copy">
              <span>READ</span>
              <strong>
                <b id="progress-read">0</b> / <b id="progress-expected">0</b>
              </strong>
              <div class="meter-track">
                <i id="progress-bar"></i>
              </div>
              <p id="progress-label">回答を待っています</p>
            </div>
          </aside>
        </div>
        <SummaryTiles />
        <form class="response-card" id="response-form">
          <header>
            <small>YOUR CHECK</small>
            <h2>この回覧を確認する</h2>
          </header>
          <label class="field">
            <span>世帯の呼び名・班番号</span>
            <input id="label" maxlength={20} placeholder="3班 12番" required />
          </label>
          <fieldset class="segmented" id="response-options">
            <legend>行事の出欠</legend>
            <label>
              <input checked name="response" type="radio" value="yes" />
              <span>参加</span>
            </label>
            <label>
              <input name="response" type="radio" value="maybe" />
              <span>未定</span>
            </label>
            <label>
              <input name="response" type="radio" value="no" />
              <span>欠席</span>
            </label>
          </fieldset>
          <label class="field">
            <span>
              役員へのメモ <small>任意・全員には見えません</small>
            </span>
            <textarea id="note" maxlength={80} placeholder="1名で参加します" rows={2}></textarea>
          </label>
          <label class="honeypot" aria-hidden="true">
            Website
            <input id="response-website" tabindex={-1} />
          </label>
          <button class="button primary" id="save-button" type="submit">
            読みました <span aria-hidden="true">✓</span>
          </button>
          <p class="action-status" id="response-status" aria-live="polite"></p>
        </form>
        <button class="report-link" id="report-button" type="button">
          この回覧を報告
        </button>
      </section>
      <script src="/notice.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ManagePage({ noticeId, title }: { noticeId: string; title: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/manage/${noticeId}`}
      noindex
      title={`管理 | ${title} | ${product.name}`}
    >
      <section class="manage-shell" data-notice-id={noticeId} id="manage-app">
        <header class="manage-header">
          <div>
            <span class="eyebrow">CIRCULATION DESK</span>
            <h1>{title}</h1>
            <p id="manage-meta">回覧を読み込んでいます</p>
          </div>
          <span class="state-pill" id="manage-state">
            回答受付中
          </span>
        </header>
        <div class="owner-links">
          <article>
            <span>01</span>
            <div>
              <small>世帯へ共有</small>
              <strong>回答URL</strong>
            </div>
            <button class="button compact" id="copy-notice" type="button">
              コピー
            </button>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>この端末へ保存</small>
              <strong>管理URL</strong>
            </div>
            <button class="button compact" id="copy-owner" type="button">
              コピー
            </button>
          </article>
        </div>
        <SummaryTiles />
        <div class="manage-grid">
          <section class="reader-panel">
            <header>
              <span>READERS</span>
              <strong id="response-total">0件</strong>
              <button class="text-button" id="refresh-button" type="button">
                更新
              </button>
            </header>
            <div class="reader-list" id="reader-list">
              <p class="empty-state">まだ確認はありません。</p>
            </div>
          </section>
          <aside class="completion-panel">
            <header>
              <span>LIGHTS</span>
              <strong id="completion-result">回答待ち</strong>
            </header>
            <LightRing compact title={title} />
            <div class="meter-track">
              <i id="owner-progress-bar"></i>
            </div>
            <p id="owner-progress-label">0 / 0 世帯</p>
          </aside>
        </div>
        <div class="manage-actions">
          <button class="button compact" id="csv-button" type="button">
            CSVを保存
          </button>
          <button class="button compact" id="toggle-button" type="button">
            回答を締め切る
          </button>
          <button class="text-button danger" id="delete-button" type="button">
            回覧を削除
          </button>
        </div>
        <p class="action-status" id="manage-message" aria-live="polite"></p>
      </section>
      <script src="/manage.js?v=1" type="module"></script>
    </Layout>
  );
}

export function GuidePage() {
  return (
    <Layout title={`使い方 | ${product.name}`}>
      <article class="guide-board">
        <header>
          <span class="eyebrow">ONE NOTICE AT A TIME</span>
          <h1>一枚つくり、いつもの連絡先へ。</h1>
          <p>住民アプリや名簿を作らず、次の回覧だけを小さくデジタル化します。</p>
        </header>
        <ol class="guide-steps">
          <li>
            <span>01</span>
            <div class="guide-icon">▤</div>
            <h2>役員が回覧を作る</h2>
            <p>件名、本文、期限と、既読だけか行事の出欠かを決めます。</p>
          </li>
          <li>
            <span>02</span>
            <div class="guide-icon">↗</div>
            <h2>回答URLを共有する</h2>
            <p>LINE、メール、QRなど、普段使っている連絡先へURLを流します。</p>
          </li>
          <li>
            <span>03</span>
            <div class="guide-icon">●</div>
            <h2>灯りで確認する</h2>
            <p>公開画面は集計だけ。世帯の呼び名とメモは役員の管理画面だけに表示します。</p>
          </li>
        </ol>
        <section class="guide-note">
          <strong>緊急連絡には使わないでください</strong>
          <p>
            通知や到達保証はありません。防災、安否確認、安全に関わる連絡は自治体の公式情報や電話なども使ってください。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <header>
          <span class="eyebrow">PRIVACY</span>
          <h1>名簿を預からない、一回覧。</h1>
        </header>
        <section>
          <h2>保存するもの</h2>
          <p>
            発信元、件名、本文、期限、目安世帯数、世帯の呼び名・班番号、回答、任意メモを保存します。氏名、住所、電話番号、メール、写真、位置情報は入力しないでください。
          </p>
        </section>
        <section>
          <h2>見える範囲</h2>
          <p>
            回答URLには回覧本文と集計値だけを表示します。世帯の呼び名とメモは秘密鍵つき管理URLでだけ確認できます。
          </p>
        </section>
        <section>
          <h2>削除と計測</h2>
          <p>
            回覧、回答、匿名の操作記録は21日後に削除します。Cookie、IPアドレス、User-Agentを保存せず、本文や呼び名を計測データへ含めません。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout noindex title={`見つかりません | ${product.name}`}>
      <section class="not-found">
        <span>404</span>
        <h1>この回覧は見つかりません。</h1>
        <p>URLが違うか、削除または21日を過ぎた可能性があります。</p>
        <a class="button compact" href="/">
          トップへ戻る
        </a>
      </section>
    </Layout>
  );
}
