import { apiJson, isAutomatedQa, sessionId, setStatus, track, trackVisit } from "./common.js";

const form = document.querySelector("#create-form");
const button = document.querySelector("#create-button");
const status = document.querySelector("#create-status");
const deadlineInput = document.querySelector("#deadline");

if (deadlineInput instanceof HTMLInputElement) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  })
    .formatToParts(new Date())
    .reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12);
  const date = (offset) => new Date(today + offset * 86400000).toISOString().slice(0, 10);
  deadlineInput.min = date(0);
  deadlineInput.max = date(30);
  deadlineInput.value = date(7);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !(form instanceof HTMLFormElement) ||
    !(button instanceof HTMLButtonElement) ||
    !form.reportValidity()
  ) {
    return;
  }
  button.disabled = true;
  setStatus(status, "回覧を準備しています…");
  try {
    const result = await apiJson("/api/notices", {
      body: JSON.stringify({
        body: document.querySelector("#body")?.value ?? "",
        deadline: document.querySelector("#deadline")?.value ?? "",
        expectedCount: Number(document.querySelector("#expected-count")?.value ?? 0),
        responseMode: document.querySelector("#response-mode")?.value ?? "",
        sender: document.querySelector("#sender")?.value ?? "",
        sessionId,
        title: document.querySelector("#title")?.value ?? "",
        website: document.querySelector("#website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    track("notice_created", result.noticeId);
    const query = isAutomatedQa ? "?qa=1" : "";
    location.assign(
      `/manage/${result.noticeId}${query}#${new URLSearchParams({ owner: result.ownerToken })}`,
    );
  } catch (error) {
    const messages = {
      invalid_notice: "件名、本文、期限を確認してください。URLやメールアドレスは入れられません。",
      rate_limited: "今日はすでに10件作成しています。明日もう一度お試しください。",
    };
    setStatus(
      status,
      messages[error.message] ?? "回覧を作れませんでした。少し待ってからお試しください。",
      "error",
    );
    button.disabled = false;
  }
});

trackVisit("home");
