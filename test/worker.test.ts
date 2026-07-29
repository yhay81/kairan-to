import { describe, expect, it, vi } from "vitest";

import { app, type Bindings } from "../src/worker";

const noticeId = "a".repeat(32);
const acknowledgementId = "b".repeat(32);
const ownerToken = "1".repeat(64);
const editToken = "2".repeat(64);
const browserSessionId = "21d6f5db-2a77-4dd2-8319-e45fe918e687";
const respondentSessionId = "38b80262-aaf5-4cf4-91f7-4dc052f9f08e";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const ownerHash = "3138bb9bc78df27c473ecfd1410f7bd45ebac1f59cf3ff9cfe4db77aab7aedd3";
const editHash = "4f2e8d65483c641648cdb374ae9d8abd368d269e4ddffe092a8237b8162cddd6";

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

type StoredAcknowledgement = {
  created_at: number;
  edit_token_hash: string;
  id: string;
  label: string;
  note: string;
  notice_id: string;
  respondent_session_id: string;
  response: "maybe" | "no" | "read" | "yes";
  updated_at: number;
};

type TestState = {
  acknowledgements: StoredAcknowledgement[];
  notice: {
    body: string;
    created_at: number;
    deadline: string;
    expected_count: number;
    expires_at: number;
    id: string;
    owner_token_hash: string;
    response_mode: "attendance" | "read";
    sender: string;
    status: "closed" | "hidden" | "open";
    title: string;
  } | null;
  recentNotices: number;
  reportCount: number;
};

type Call = {
  arguments: unknown[];
  sql: string;
};

const defaultState = (): TestState => ({
  acknowledgements: [
    {
      created_at: 1_721_000_100,
      edit_token_hash: editHash,
      id: acknowledgementId,
      label: "3班 12番",
      note: "1名で参加します",
      notice_id: noticeId,
      respondent_session_id: browserSessionId,
      response: "yes",
      updated_at: 1_721_000_100,
    },
  ],
  notice: {
    body: "8月10日、集会所で夏まつりの準備をします。",
    created_at: 1_721_000_000,
    deadline: tomorrow,
    expected_count: 12,
    expires_at: 4_102_444_800,
    id: noticeId,
    owner_token_hash: ownerHash,
    response_mode: "attendance",
    sender: "ひだまり町内会",
    status: "open",
    title: "夏まつり準備のお知らせ",
  },
  recentNotices: 0,
  reportCount: 0,
});

const makeBindings = (partial: Partial<TestState> = {}) => {
  const state = { ...defaultState(), ...partial };
  const calls: Call[] = [];

  const prepare = vi.fn((sql: string) => {
    let arguments_: unknown[] = [];
    const call = { arguments: arguments_, sql };
    calls.push(call);
    const statement = {
      all: async () => ({ results: state.acknowledgements }),
      bind: (...values: unknown[]) => {
        arguments_ = values;
        call.arguments = values;
        return statement;
      },
      first: async () => {
        if (sql.includes("COUNT(*) AS count FROM notices")) {
          return { count: state.recentNotices };
        }
        if (sql.includes("COUNT(*) AS read_count")) {
          const relevant = state.acknowledgements.filter(
            (acknowledgement) => acknowledgement.notice_id === arguments_[0],
          );
          return {
            maybe_count: relevant.filter((item) => item.response === "maybe").length,
            no_count: relevant.filter((item) => item.response === "no").length,
            read_count: relevant.length,
            yes_count: relevant.filter((item) => item.response === "yes").length,
          };
        }
        if (sql.includes("COUNT(*) AS total")) {
          return {
            own: state.acknowledgements.filter(
              (item) =>
                item.respondent_session_id === arguments_[0] && item.notice_id === arguments_[1],
            ).length,
            total: state.acknowledgements.filter((item) => item.notice_id === arguments_[1]).length,
          };
        }
        if (sql.includes("SELECT edit_token_hash FROM acknowledgements")) {
          return (
            state.acknowledgements.find(
              (item) =>
                item.id === arguments_[0] &&
                item.notice_id === arguments_[1] &&
                item.respondent_session_id === arguments_[2],
            ) ?? null
          );
        }
        if (sql.includes("COUNT(*) AS count FROM reports")) {
          return { count: state.reportCount };
        }
        if (sql.includes("FROM notices") && sql.includes("expires_at > unixepoch()")) {
          return state.notice?.id === arguments_[0] ? state.notice : null;
        }
        return null;
      },
      raw: async () => [],
      run: async () => {
        if (sql.includes("INSERT INTO acknowledgements")) {
          state.acknowledgements.push({
            created_at: 1_721_000_200,
            edit_token_hash: arguments_[2] as string,
            id: arguments_[0] as string,
            label: arguments_[4] as string,
            note: arguments_[6] as string,
            notice_id: arguments_[1] as string,
            respondent_session_id: arguments_[3] as string,
            response: arguments_[5] as StoredAcknowledgement["response"],
            updated_at: 1_721_000_200,
          });
        }
        if (sql.includes("UPDATE notices SET status") && state.notice) {
          state.notice.status = arguments_[0] as "closed" | "hidden" | "open";
        }
        return { meta: { changes: 1 } };
      },
    };
    return statement as unknown as D1PreparedStatement;
  });

  const db = {
    batch: vi.fn(async () => []),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    prepare,
    withSession: vi.fn(),
  } as unknown as D1Database;
  const bindings = {
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    DB: db,
  } satisfies Bindings;
  return { bindings, calls };
};

const jsonHeaders = {
  "content-type": "application/json",
  origin: "http://localhost",
  "sec-fetch-site": "same-origin",
};

const validNotice = () => ({
  body: "8月10日、集会所で夏まつりの準備をします。",
  deadline: tomorrow,
  expectedCount: 12,
  responseMode: "attendance",
  sender: "ひだまり町内会",
  sessionId: browserSessionId,
  title: "夏まつり準備のお知らせ",
  website: "",
});

const validAcknowledgement = (sessionId = respondentSessionId) => ({
  label: "4班 3番",
  note: "",
  response: "yes",
  sessionId,
  website: "",
});

describe("回覧灯 worker", () => {
  it("公開ページに製品情報とセキュリティヘッダーを返す", async () => {
    const { bindings } = makeBindings();
    for (const path of ["/", "/guide", "/privacy"]) {
      const response = await app.request(path, undefined, bindings);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(await response.text()).toContain("回覧灯");
    }
  });

  it("回答画面と管理画面を非公開・noindexにする", async () => {
    const { bindings } = makeBindings();
    for (const path of [`/n/${noticeId}`, `/manage/${noticeId}`]) {
      const response = await app.request(path, undefined, bindings);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(html).toContain(`data-notice-id="${noticeId}"`);
    }
  });

  it("非表示の回覧を公開しない", async () => {
    const state = defaultState();
    if (state.notice) state.notice.status = "hidden";
    const { bindings } = makeBindings(state);
    expect((await app.request(`/n/${noticeId}`, undefined, bindings)).status).toBe(404);
  });

  it("公開APIは回覧と集計だけを返す", async () => {
    const { bindings } = makeBindings();
    const response = await app.request(`/api/notices/${noticeId}`, undefined, bindings);
    const body = await response.json<Record<string, unknown>>();
    expect(response.status).toBe(200);
    expect(body.summary).toEqual({ maybe: 0, no: 0, read: 1, yes: 1 });
    expect(body).not.toHaveProperty("acknowledgements");
    expect(JSON.stringify(body)).not.toContain("3班 12番");
    expect(JSON.stringify(body)).not.toContain("1名で参加");
  });

  it("管理鍵をハッシュ化して回覧を作る", async () => {
    const { bindings, calls } = makeBindings({ acknowledgements: [], notice: null });
    const response = await app.request(
      "/api/notices",
      { body: JSON.stringify(validNotice()), headers: jsonHeaders, method: "POST" },
      bindings,
    );
    const body = await response.json<{ noticeId: string; ownerToken: string }>();
    const insert = calls.find((call) => call.sql.includes("INSERT INTO notices"));
    expect(response.status).toBe(201);
    expect(body.noticeId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.ownerToken).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(body.ownerToken);
    expect(insert?.arguments[1]).toBe(await hash(body.ownerToken));
  });

  it("不正値・URL・越境・作成上限を拒否する", async () => {
    const cases = [
      { body: { ...validNotice(), body: "https://example.com" }, status: 400 },
      { body: { ...validNotice(), deadline: "2020-01-01" }, status: 400 },
      { body: { ...validNotice(), expectedCount: 0 }, status: 400 },
    ];
    for (const value of cases) {
      const response = await app.request(
        "/api/notices",
        { body: JSON.stringify(value.body), headers: jsonHeaders, method: "POST" },
        makeBindings().bindings,
      );
      expect(response.status).toBe(value.status);
    }
    expect(
      (
        await app.request(
          "/api/notices",
          {
            body: JSON.stringify(validNotice()),
            headers: { ...jsonHeaders, origin: "https://evil.example" },
            method: "POST",
          },
          makeBindings().bindings,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          "/api/notices",
          { body: JSON.stringify(validNotice()), headers: jsonHeaders, method: "POST" },
          makeBindings({ recentNotices: 10 }).bindings,
        )
      ).status,
    ).toBe(429);
  });

  it("回答の編集鍵を別にハッシュ化する", async () => {
    const { bindings, calls } = makeBindings({ acknowledgements: [] });
    const response = await app.request(
      `/api/notices/${noticeId}/acknowledgements`,
      { body: JSON.stringify(validAcknowledgement()), headers: jsonHeaders, method: "POST" },
      bindings,
    );
    const body = await response.json<{ acknowledgementId: string; editToken: string }>();
    const insert = calls.find((call) => call.sql.includes("INSERT INTO acknowledgements"));
    expect(response.status).toBe(201);
    expect(body.acknowledgementId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.editToken).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(body.editToken);
    expect(insert?.arguments[2]).toBe(await hash(body.editToken));
  });

  it("読了モードでは出欠値を保存しない", async () => {
    const state = defaultState();
    if (state.notice) state.notice.response_mode = "read";
    state.acknowledgements = [];
    const { bindings, calls } = makeBindings(state);
    const response = await app.request(
      `/api/notices/${noticeId}/acknowledgements`,
      { body: JSON.stringify(validAcknowledgement()), headers: jsonHeaders, method: "POST" },
      bindings,
    );
    const insert = calls.find((call) => call.sql.includes("INSERT INTO acknowledgements"));
    expect(response.status).toBe(201);
    expect(insert?.arguments[5]).toBe("read");
  });

  it("同じ端末と編集鍵だけで回答を上書きできる", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      `/api/notices/${noticeId}/acknowledgements`,
      {
        body: JSON.stringify({
          ...validAcknowledgement(browserSessionId),
          acknowledgementId,
          editToken,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.sql.includes("UPDATE acknowledgements"))).toBe(true);
    const denied = await app.request(
      `/api/notices/${noticeId}/acknowledgements`,
      {
        body: JSON.stringify({
          ...validAcknowledgement(browserSessionId),
          acknowledgementId,
          editToken: "3".repeat(64),
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(denied.status).toBe(403);
  });

  it("同じ匿名端末の二重回答を拒否する", async () => {
    const { bindings } = makeBindings();
    const response = await app.request(
      `/api/notices/${noticeId}/acknowledgements`,
      {
        body: JSON.stringify(validAcknowledgement(browserSessionId)),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "already_answered" });
  });

  it("呼び名とメモは管理鍵にだけ返す", async () => {
    const { bindings } = makeBindings();
    const owner = await app.request(
      `/api/notices/${noticeId}/manage`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
      bindings,
    );
    const denied = await app.request(
      `/api/notices/${noticeId}/manage`,
      { headers: { authorization: `Bearer ${"9".repeat(64)}` } },
      bindings,
    );
    const body = await owner.json<{
      acknowledgements: Array<{ label: string; note: string }>;
    }>();
    expect(owner.status).toBe(200);
    expect(body.acknowledgements[0]).toMatchObject({
      label: "3班 12番",
      note: "1名で参加します",
    });
    expect(denied.status).toBe(403);
  });

  it("管理者が締切と削除を実行できる", async () => {
    const { bindings, calls } = makeBindings();
    const closed = await app.request(
      `/api/notices/${noticeId}/status`,
      {
        body: JSON.stringify({ status: "closed" }),
        headers: { ...jsonHeaders, authorization: `Bearer ${ownerToken}` },
        method: "PATCH",
      },
      bindings,
    );
    const deleted = await app.request(
      `/api/notices/${noticeId}`,
      {
        headers: { ...jsonHeaders, authorization: `Bearer ${ownerToken}` },
        method: "DELETE",
      },
      bindings,
    );
    expect(closed.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(calls.some((call) => call.sql.includes("DELETE FROM notices"))).toBe(true);
  });

  it("三件の独立報告で回覧を隠す", async () => {
    const { bindings, calls } = makeBindings({ reportCount: 3 });
    const response = await app.request(
      `/api/notices/${noticeId}/report`,
      {
        body: JSON.stringify({ reason: "spam", sessionId: browserSessionId }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("UPDATE notices SET status = 'hidden'") &&
          call.arguments[0] === noticeId,
      ),
    ).toBe(true);
  });

  it("自動QAを計測せず、通常計測は21日で削除する", async () => {
    const qa = makeBindings();
    const qaResponse = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: noticeId,
          name: "response_saved",
          sessionId: browserSessionId,
        }),
        headers: { ...jsonHeaders, "x-automated-qa": "1" },
        method: "POST",
      },
      qa.bindings,
    );
    expect(qaResponse.status).toBe(204);
    expect(qa.calls.some((call) => call.sql.includes("INSERT OR IGNORE INTO product_events"))).toBe(
      false,
    );

    const regular = makeBindings();
    const response = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: noticeId,
          name: "response_saved",
          sessionId: browserSessionId,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      regular.bindings,
    );
    expect(response.status).toBe(204);
    expect(
      regular.calls.some(
        (call) =>
          call.sql.includes("DELETE FROM product_events") && call.sql.includes("21 * 86400"),
      ),
    ).toBe(true);
  });

  it("ヘルスと未定義APIをJSONで返す", async () => {
    const { bindings } = makeBindings();
    const health = await app.request("/healthz", undefined, bindings);
    expect(await health.json()).toMatchObject({ healthy: true, service: "kairan-to" });
    const missing = await app.request("/api/missing", undefined, bindings);
    const body = await missing.json<{ error: string; requestId: string }>();
    expect(missing.status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(body.requestId).toBeTruthy();
  });
});
