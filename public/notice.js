import {
  apiJson,
  formatDeadline,
  readSecret,
  rememberSecrets,
  sessionId,
  setStatus,
  track,
  trackVisit,
} from "./common.js";

const app = document.querySelector("#notice-app");
const id = app?.dataset.noticeId ?? "";
const form = document.querySelector("#response-form");
const status = document.querySelector("#response-status");
const saveButton = document.querySelector("#save-button");
const responseOptions = document.querySelector("#response-options");
let model = null;

const selectedResponse = () => form?.querySelector('input[name="response"]:checked')?.value ?? "";

const setText = (selector, value) => {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
};

const setLights = (read, expected) => {
  const ring = document.querySelector(".progress-panel .light-ring");
  if (!(ring instanceof HTMLElement)) return;
  const lights = [...ring.querySelectorAll(".house-light")];
  const ratio = expected > 0 ? Math.min(1, read / expected) : 0;
  const litCount = read > 0 ? Math.max(1, Math.round(ratio * lights.length)) : 0;
  lights.forEach((light, index) => {
    light.dataset.lit = index < litCount ? "true" : "false";
    const label = light.querySelector("b");
    if (label) label.textContent = index < litCount ? "灯" : "・";
  });
};

const render = () => {
  if (!model) return;
  setText("#notice-sender", model.sender || "回覧");
  setText("#notice-title", model.title);
  setText("#notice-body", model.body);
  setText("#notice-deadline", `${formatDeadline(model.deadline)}まで`);
  setText("#notice-state", model.status === "open" ? "回答受付中" : "受付終了");
  setText("#read-count", model.summary.read);
  setText("#yes-count", model.summary.yes);
  setText("#maybe-count", model.summary.maybe);
  setText("#no-count", model.summary.no);
  setText("#progress-read", model.summary.read);
  setText("#progress-expected", model.expectedCount);
  const remaining = Math.max(0, model.expectedCount - model.summary.read);
  setText(
    "#progress-label",
    model.summary.read >= model.expectedCount
      ? "ひと回りしました"
      : model.summary.read === 0
        ? "最初の灯りを待っています"
        : `あと${remaining}世帯です`,
  );
  const progress = document.querySelector("#progress-bar");
  if (progress instanceof HTMLElement) {
    progress.style.width = `${Math.min(100, (model.summary.read / model.expectedCount) * 100)}%`;
  }
  setLights(model.summary.read, model.expectedCount);

  const attendance = model.responseMode === "attendance";
  if (responseOptions instanceof HTMLElement) responseOptions.hidden = !attendance;
  document.querySelectorAll(".attendance-tile").forEach((tile) => {
    if (tile instanceof HTMLElement) tile.hidden = !attendance;
  });
  if (saveButton) saveButton.firstChild.textContent = attendance ? " 回答を残す " : " 読みました ";
  if (form instanceof HTMLFormElement) {
    [...form.elements].forEach((control) => {
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLButtonElement
      ) {
        control.disabled = model.status !== "open";
      }
    });
  }
  if (model.status !== "open") setStatus(status, "この回覧の回答受付は終了しました。");
};

const load = async () => {
  model = await apiJson(`/api/notices/${id}`);
  render();
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !(form instanceof HTMLFormElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !form.reportValidity()
  ) {
    return;
  }
  saveButton.disabled = true;
  setStatus(status, "灯りを点けています…");
  const acknowledgementId = readSecret(id, "acknowledgementId");
  const editToken = readSecret(id, "editToken");
  try {
    const result = await apiJson(`/api/notices/${id}/acknowledgements`, {
      body: JSON.stringify({
        acknowledgementId,
        editToken,
        label: document.querySelector("#label")?.value ?? "",
        note: document.querySelector("#note")?.value ?? "",
        response: model?.responseMode === "attendance" ? selectedResponse() : "read",
        sessionId,
        website: document.querySelector("#response-website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    rememberSecrets(id, {
      acknowledgementId: result.acknowledgementId || acknowledgementId,
      editToken: result.editToken || editToken,
    });
    setStatus(status, "確認を保存しました。この端末から上書きできます。", "success");
    track("response_saved", id);
    await load();
  } catch (error) {
    const messages = {
      access_denied: "この端末の編集鍵を確認できません。",
      already_answered: "この端末からは確認済みです。ページを読み直してください。",
      invalid_acknowledgement: "呼び名や入力内容を確認してください。URLや連絡先は入れられません。",
      notice_closed: "この回覧の回答受付は終了しました。",
      notice_full: "回答数の上限に達しました。",
    };
    setStatus(
      status,
      messages[error.message] ?? "保存できませんでした。もう一度お試しください。",
      "error",
    );
  } finally {
    if (model?.status === "open") saveButton.disabled = false;
  }
});

document.querySelector("#report-button")?.addEventListener("click", async () => {
  if (!confirm("迷惑な回覧として報告しますか？")) return;
  try {
    await apiJson(`/api/notices/${id}/report`, {
      body: JSON.stringify({ reason: "other", sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setStatus(status, "報告を受け付けました。", "success");
  } catch {
    setStatus(status, "報告できませんでした。", "error");
  }
});

load().catch(() => setStatus(status, "回覧を読み込めませんでした。", "error"));
trackVisit(id);
