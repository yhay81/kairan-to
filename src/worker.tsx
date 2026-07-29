import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import { GuidePage, HomePage, ManagePage, NoticePage, NotFoundPage, PrivacyPage } from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings; Variables: { requestId: string } }>;
type NoticeStatus = "closed" | "hidden" | "open";
type ResponseMode = "attendance" | "read";
type AcknowledgementResponse = "maybe" | "no" | "read" | "yes";

type NoticeRow = {
  body: string;
  created_at: number;
  deadline: string;
  expected_count: number;
  expires_at: number;
  id: string;
  owner_token_hash: string;
  response_mode: ResponseMode;
  sender: string;
  status: NoticeStatus;
  title: string;
};

type AcknowledgementRow = {
  created_at: number;
  id: string;
  label: string;
  note: string;
  response: AcknowledgementResponse;
  updated_at: number;
};

type AggregateRow = {
  maybe_count: number;
  no_count: number;
  read_count: number;
  yes_count: number;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 429,
  ) {
    super(code);
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: { requestId: string } }>();
const idPattern = /^[0-9a-f]{32}$/i;
const secretPattern = /^[0-9a-f]{64}$/i;
const browserSessionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const responseModes = new Set<ResponseMode>(["read", "attendance"]);
const attendanceResponses = new Set<AcknowledgementResponse>(["yes", "maybe", "no"]);
const reportReasons = new Set(["spam", "unsafe", "other"]);
const telemetryNames = new Set([
  "visited",
  "notice_created",
  "link_copied",
  "response_saved",
  "owner_opened",
  "notice_closed",
  "returned",
]);
const blockedLinkPattern =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|jp|io|app|dev)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

const randomHex = (byteLength: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sameHash = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const cleanup = (db: D1Database) =>
  db.batch([
    db.prepare("DELETE FROM notices WHERE expires_at <= unixepoch()"),
    db.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (21 * 86400)"),
  ]);

const enforceSameOrigin = (c: AppContext) => {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError("cross_site_request", 403);
  }
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    throw new ApiError("cross_site_request", 403);
  }
};

const parseJson = async (c: AppContext, maximumBytes: number) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("unsupported_media_type", 415);
  }
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};

const cleanText = (value: unknown, maximumLength: number) => {
  if (typeof value !== "string") return "";
  return Array.from(value.normalize("NFKC"))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
};

const cleanBody = (value: unknown, maximumLength: number) => {
  if (typeof value !== "string") return "";
  return Array.from(value.normalize("NFKC"))
    .map((character) => {
      const code = character.charCodeAt(0);
      if (character === "\n") return "\n";
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replaceAll(/[^\S\n]+/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximumLength);
};

const integerInRange = (value: unknown, minimum: number, maximum: number) => {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const validDeadline = (value: string) => {
  if (!datePattern.test(value)) return false;
  const deadline = Date.parse(`${value}T00:00:00Z`);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(deadline) && deadline >= todayDay && deadline <= todayDay + 30 * 86400000;
};

const getNotice = (db: D1Database, noticeId: string) =>
  db
    .prepare(
      `SELECT id, owner_token_hash, sender, title, body, response_mode,
        expected_count, deadline, status, created_at, expires_at
       FROM notices
       WHERE id = ? AND expires_at > unixepoch()`,
    )
    .bind(noticeId)
    .first<NoticeRow>();

const bearerToken = (c: AppContext) => {
  const authorization = c.req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretPattern.test(token)) throw new ApiError("access_denied", 403);
  return token;
};

const requireOwner = async (c: AppContext, noticeId: string) => {
  const token = bearerToken(c);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || !sameHash(await sha256(token), notice.owner_token_hash)) {
    throw new ApiError("access_denied", 403);
  }
  return notice;
};

const getAggregates = async (db: D1Database, noticeId: string) => {
  const row = await db
    .prepare(
      `SELECT
        COUNT(*) AS read_count,
        COUNT(CASE WHEN response = 'yes' THEN 1 END) AS yes_count,
        COUNT(CASE WHEN response = 'maybe' THEN 1 END) AS maybe_count,
        COUNT(CASE WHEN response = 'no' THEN 1 END) AS no_count
       FROM acknowledgements WHERE notice_id = ?`,
    )
    .bind(noticeId)
    .first<AggregateRow>();
  return {
    maybe: Number(row?.maybe_count ?? 0),
    no: Number(row?.no_count ?? 0),
    read: Number(row?.read_count ?? 0),
    yes: Number(row?.yes_count ?? 0),
  };
};

const publicNotice = async (db: D1Database, notice: NoticeRow) => ({
  body: notice.body,
  deadline: notice.deadline,
  expectedCount: notice.expected_count,
  id: notice.id,
  responseMode: notice.response_mode,
  sender: notice.sender,
  status: notice.status,
  summary: await getAggregates(db, notice.id),
  title: notice.title,
});

const isAutomatedQa = (c: AppContext) => {
  if (c.req.header("x-automated-qa") === "1") return true;
  const referer = c.req.header("referer");
  if (!referer) return false;
  try {
    return new URL(referer).searchParams.get("qa") === "1";
  } catch {
    return false;
  }
};

const noStore = (c: AppContext) => {
  c.header("Cache-Control", "private, no-store");
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
};

app.use("*", requestId());
app.use("*", securityHeaders);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

app.get("/", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<HomePage />);
});
app.get("/guide", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<GuidePage />);
});
app.get("/privacy", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<PrivacyPage />);
});

app.get("/n/:noticeId", async (c) => {
  noStore(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) return c.html(<NotFoundPage />, 404);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || notice.status === "hidden") return c.html(<NotFoundPage />, 404);
  return c.html(<NoticePage noticeId={noticeId} title={notice.title} />);
});

app.get("/manage/:noticeId", async (c) => {
  noStore(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) return c.html(<NotFoundPage />, 404);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || notice.status === "hidden") return c.html(<NotFoundPage />, 404);
  return c.html(<ManagePage noticeId={noticeId} title={notice.title} />);
});

app.get("/api/notices/:noticeId", async (c) => {
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || notice.status === "hidden") throw new ApiError("not_found", 404);
  return c.json(await publicNotice(c.env.DB, notice));
});

app.post("/api/notices", async (c) => {
  enforceSameOrigin(c);
  const payload = await parseJson(c, 8192);
  if (!payload || typeof payload !== "object") throw new ApiError("invalid_notice", 400);
  const source = payload as Record<string, unknown>;
  const sender = cleanText(source.sender, 40);
  const title = cleanText(source.title, 60);
  const body = cleanBody(source.body, 800);
  const responseModeValue = typeof source.responseMode === "string" ? source.responseMode : "";
  const expectedCount = integerInRange(source.expectedCount, 1, 200);
  const deadline = cleanText(source.deadline, 10);
  const creatorSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !title ||
    !body ||
    !responseModes.has(responseModeValue as ResponseMode) ||
    expectedCount === null ||
    !validDeadline(deadline) ||
    !browserSessionPattern.test(creatorSessionId) ||
    website ||
    blockedLinkPattern.test(sender) ||
    blockedLinkPattern.test(title) ||
    blockedLinkPattern.test(body)
  ) {
    throw new ApiError("invalid_notice", 400);
  }
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notices
     WHERE creator_session_id = ? AND created_at > unixepoch() - 86400`,
  )
    .bind(creatorSessionId)
    .first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 10) throw new ApiError("rate_limited", 429);

  const noticeId = randomHex(16);
  const ownerToken = randomHex(32);
  await c.env.DB.prepare(
    `INSERT INTO notices (
      id, owner_token_hash, creator_session_id, sender, title, body,
      response_mode, expected_count, deadline, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch() + (21 * 86400))`,
  )
    .bind(
      noticeId,
      await sha256(ownerToken),
      creatorSessionId,
      sender,
      title,
      body,
      responseModeValue,
      expectedCount,
      deadline,
    )
    .run();
  return c.json({ expiresInDays: 21, noticeId, ownerToken }, 201);
});

app.post("/api/notices/:noticeId/acknowledgements", async (c) => {
  enforceSameOrigin(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || notice.status === "hidden") throw new ApiError("not_found", 404);
  if (notice.status !== "open") throw new ApiError("notice_closed", 409);

  const payload = await parseJson(c, 4096);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_acknowledgement", 400);
  }
  const source = payload as Record<string, unknown>;
  const label = cleanText(source.label, 20);
  const note = cleanText(source.note, 80);
  const responseValue = typeof source.response === "string" ? source.response : "";
  const response =
    notice.response_mode === "read"
      ? "read"
      : attendanceResponses.has(responseValue as AcknowledgementResponse)
        ? (responseValue as AcknowledgementResponse)
        : "";
  const respondentSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !label ||
    !response ||
    !browserSessionPattern.test(respondentSessionId) ||
    website ||
    blockedLinkPattern.test(label) ||
    blockedLinkPattern.test(note)
  ) {
    throw new ApiError("invalid_acknowledgement", 400);
  }

  const acknowledgementId =
    typeof source.acknowledgementId === "string" ? source.acknowledgementId : "";
  const editToken = typeof source.editToken === "string" ? source.editToken : "";
  if (acknowledgementId || editToken) {
    if (!idPattern.test(acknowledgementId) || !secretPattern.test(editToken)) {
      throw new ApiError("access_denied", 403);
    }
    const stored = await c.env.DB.prepare(
      `SELECT edit_token_hash FROM acknowledgements
       WHERE id = ? AND notice_id = ? AND respondent_session_id = ?`,
    )
      .bind(acknowledgementId, noticeId, respondentSessionId)
      .first<{ edit_token_hash: string }>();
    if (!stored || !sameHash(await sha256(editToken), stored.edit_token_hash)) {
      throw new ApiError("access_denied", 403);
    }
    await c.env.DB.prepare(
      `UPDATE acknowledgements
       SET label = ?, response = ?, note = ?, updated_at = unixepoch()
       WHERE id = ? AND notice_id = ?`,
    )
      .bind(label, response, note, acknowledgementId, noticeId)
      .run();
    return c.json({ acknowledgementId, saved: true, updated: true });
  }

  const counts = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COUNT(CASE WHEN respondent_session_id = ? THEN 1 END) AS own
     FROM acknowledgements WHERE notice_id = ?`,
  )
    .bind(respondentSessionId, noticeId)
    .first<{ own: number; total: number }>();
  if (Number(counts?.total ?? 0) >= 250) throw new ApiError("notice_full", 409);
  if (Number(counts?.own ?? 0) >= 1) throw new ApiError("already_answered", 409);

  const newAcknowledgementId = randomHex(16);
  const newEditToken = randomHex(32);
  await c.env.DB.prepare(
    `INSERT INTO acknowledgements (
      id, notice_id, edit_token_hash, respondent_session_id,
      label, response, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  )
    .bind(
      newAcknowledgementId,
      noticeId,
      await sha256(newEditToken),
      respondentSessionId,
      label,
      response,
      note,
    )
    .run();
  return c.json(
    {
      acknowledgementId: newAcknowledgementId,
      editToken: newEditToken,
      saved: true,
    },
    201,
  );
});

app.get("/api/notices/:noticeId/manage", async (c) => {
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  const notice = await requireOwner(c, noticeId);
  const acknowledgements = await c.env.DB.prepare(
    `SELECT id, label, response, note, created_at, updated_at
     FROM acknowledgements WHERE notice_id = ? ORDER BY updated_at DESC`,
  )
    .bind(noticeId)
    .all<AcknowledgementRow>();
  return c.json({
    ...(await publicNotice(c.env.DB, notice)),
    acknowledgements: acknowledgements.results.map((item) => ({
      createdAt: new Date(item.created_at * 1000).toISOString(),
      id: item.id,
      label: item.label,
      note: item.note,
      response: item.response,
      updatedAt: new Date(item.updated_at * 1000).toISOString(),
    })),
  });
});

app.patch("/api/notices/:noticeId/status", async (c) => {
  enforceSameOrigin(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  await requireOwner(c, noticeId);
  const payload = await parseJson(c, 1024);
  const status =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).status : "";
  if (status !== "open" && status !== "closed") throw new ApiError("invalid_status", 400);
  await c.env.DB.prepare("UPDATE notices SET status = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(status, noticeId)
    .run();
  return c.json({ status });
});

app.delete("/api/notices/:noticeId", async (c) => {
  enforceSameOrigin(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  await requireOwner(c, noticeId);
  await c.env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(noticeId).run();
  return c.body(null, 204);
});

app.post("/api/notices/:noticeId/report", async (c) => {
  enforceSameOrigin(c);
  const noticeId = c.req.param("noticeId");
  if (!idPattern.test(noticeId)) throw new ApiError("not_found", 404);
  const notice = await getNotice(c.env.DB, noticeId);
  if (!notice || notice.status === "hidden") throw new ApiError("not_found", 404);
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") throw new ApiError("invalid_report", 400);
  const source = payload as Record<string, unknown>;
  const reporterSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const reason = typeof source.reason === "string" ? source.reason : "";
  if (!browserSessionPattern.test(reporterSessionId) || !reportReasons.has(reason)) {
    throw new ApiError("invalid_report", 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO reports
      (notice_id, reporter_session_id, reason, created_at)
     VALUES (?, ?, ?, unixepoch())`,
  )
    .bind(noticeId, reporterSessionId, reason)
    .run();
  const result = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE notice_id = ?")
    .bind(noticeId)
    .first<{ count: number }>();
  if (Number(result?.count ?? 0) >= 3) {
    await c.env.DB.prepare(
      "UPDATE notices SET status = 'hidden', updated_at = unixepoch() WHERE id = ?",
    )
      .bind(noticeId)
      .run();
  }
  return c.json({ reported: true });
});

app.post("/api/telemetry", async (c) => {
  enforceSameOrigin(c);
  if (isAutomatedQa(c)) return c.body(null, 204);
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") throw new ApiError("invalid_telemetry", 400);
  const source = payload as Record<string, unknown>;
  const browserSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const name = typeof source.name === "string" ? source.name : "";
  const context = cleanText(source.context, 32);
  if (
    !browserSessionPattern.test(browserSessionId) ||
    !telemetryNames.has(name) ||
    (context !== "home" && context !== "" && !idPattern.test(context))
  ) {
    throw new ApiError("invalid_telemetry", 400);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO product_events
       (session_id, name, context, occurred_on, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).bind(browserSessionId, name, context, new Date().toISOString().slice(0, 10)),
    c.env.DB.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (21 * 86400)"),
    c.env.DB.prepare("DELETE FROM notices WHERE expires_at <= unixepoch()"),
  ]);
  return c.body(null, 204);
});

app.get("/healthz", (c) =>
  c.json({ healthy: true, service: "kairan-to", time: new Date().toISOString() }),
);

app.notFound((c) => {
  if (c.req.method === "GET" && !c.req.path.startsWith("/api/")) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.json({ error: "not_found", requestId: c.get("requestId") }, 404);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export { app };
export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Bindings, context: ExecutionContext) {
    context.waitUntil(cleanup(env.DB));
  },
};
