import {
  apiJson,
  authorization,
  copyText,
  forgetNotice,
  formatDeadline,
  linkFor,
  readSecret,
  setStatus,
  track,
  trackVisit,
} from "./common.js";

const app = document.querySelector("#manage-app");
const id = app?.dataset.noticeId ?? "";
const owner = readSecret(id, "owner");
const message = document.querySelector("#manage-message");
const readerList = document.querySelector("#reader-list");
const toggle = document.querySelector("#toggle-button");
let model = null;

const text = (tag, value, className = "") => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};

const setText = (selector, value) => {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
};

const renderReaders = () => {
  if (!(readerList instanceof HTMLElement) || !model) return;
  readerList.replaceChildren();
  if (model.acknowledgements.length === 0) {
    readerList.append(text("p", "まだ確認はありません。", "empty-state"));
    return;
  }
  const labels = { maybe: "未定", no: "欠席", read: "読了", yes: "参加" };
  model.acknowledgements.forEach((item) => {
    const row = document.createElement("article");
    row.className = "reader-person";
    row.dataset.response = item.response;
    const heading = document.createElement("div");
    heading.append(text("strong", item.label), text("span", labels[item.response], "reader-badge"));
    row.append(heading);
    if (item.note) row.append(text("p", item.note));
    readerList.append(row);
  });
};

const renderLights = () => {
  if (!model) return;
  const lights = [...document.querySelectorAll(".completion-panel .house-light")];
  const ratio = Math.min(1, model.summary.read / model.expectedCount);
  const litCount = model.summary.read > 0 ? Math.max(1, Math.round(ratio * lights.length)) : 0;
  lights.forEach((light, index) => {
    if (!(light instanceof HTMLElement)) return;
    light.dataset.lit = index < litCount ? "true" : "false";
    const label = light.querySelector("b");
    if (label) label.textContent = index < litCount ? "灯" : "・";
  });
};

const render = () => {
  if (!model) return;
  setText("#manage-meta", `${model.sender || "回覧"}・${formatDeadline(model.deadline)}まで`);
  setText("#manage-state", model.status === "open" ? "回答受付中" : "受付終了");
  setText("#response-total", `${model.acknowledgements.length}件`);
  setText("#read-count", model.summary.read);
  setText("#yes-count", model.summary.yes);
  setText("#maybe-count", model.summary.maybe);
  setText("#no-count", model.summary.no);
  setText(
    "#completion-result",
    model.summary.read >= model.expectedCount
      ? "ひと回り"
      : `あと${model.expectedCount - model.summary.read}`,
  );
  setText("#owner-progress-label", `${model.summary.read} / ${model.expectedCount} 世帯`);
  if (toggle) toggle.textContent = model.status === "open" ? "回答を締め切る" : "回答を再開";
  const progress = document.querySelector("#owner-progress-bar");
  if (progress instanceof HTMLElement) {
    progress.style.width = `${Math.min(100, (model.summary.read / model.expectedCount) * 100)}%`;
  }
  document.querySelectorAll(".attendance-tile").forEach((tile) => {
    if (tile instanceof HTMLElement) tile.hidden = model.responseMode !== "attendance";
  });
  renderReaders();
  renderLights();
};

const load = async () => {
  if (!owner) throw new Error("missing_owner");
  model = await apiJson(`/api/notices/${id}/manage`, { headers: authorization(owner) });
  render();
};

document.querySelector("#copy-notice")?.addEventListener("click", async () => {
  try {
    await copyText(linkFor(`/n/${id}`));
    setStatus(message, "回答URLをコピーしました。", "success");
    track("link_copied", id);
  } catch {
    setStatus(message, "コピーできませんでした。", "error");
  }
});

document.querySelector("#copy-owner")?.addEventListener("click", async () => {
  try {
    await copyText(linkFor(`/manage/${id}`, owner));
    setStatus(message, "管理URLをコピーしました。安全な場所に保管してください。", "success");
  } catch {
    setStatus(message, "コピーできませんでした。", "error");
  }
});

document.querySelector("#refresh-button")?.addEventListener("click", () => {
  load().catch(() => setStatus(message, "更新できませんでした。", "error"));
});

toggle?.addEventListener("click", async () => {
  if (!model) return;
  const status = model.status === "open" ? "closed" : "open";
  try {
    await apiJson(`/api/notices/${id}/status`, {
      body: JSON.stringify({ status }),
      headers: { ...authorization(owner), "content-type": "application/json" },
      method: "PATCH",
    });
    if (status === "closed") track("notice_closed", id);
    await load();
  } catch {
    setStatus(message, "受付状態を変更できませんでした。", "error");
  }
});

const csvCell = (value) => {
  const safe = String(value ?? "").replaceAll('"', '""');
  const protectedValue = /^[=+\-@]/.test(safe) ? `'${safe}` : safe;
  return `"${protectedValue}"`;
};

document.querySelector("#csv-button")?.addEventListener("click", () => {
  if (!model) return;
  const labels = { maybe: "未定", no: "欠席", read: "読了", yes: "参加" };
  const rows = [
    ["世帯の呼び名・班番号", "回答", "メモ"],
    ...model.acknowledgements.map((item) => [item.label, labels[item.response], item.note]),
  ];
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kairan-${id.slice(0, 8)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#delete-button")?.addEventListener("click", async () => {
  if (!confirm("この回覧と回答をすべて削除しますか？元に戻せません。")) return;
  try {
    await apiJson(`/api/notices/${id}`, {
      headers: authorization(owner),
      method: "DELETE",
    });
    forgetNotice(id);
    location.assign("/");
  } catch {
    setStatus(message, "削除できませんでした。", "error");
  }
});

load()
  .then(() => {
    track("owner_opened", id);
  })
  .catch((error) => {
    setStatus(
      message,
      error.message === "missing_owner"
        ? "管理鍵がありません。作成時の管理URLを開いてください。"
        : "管理画面を読み込めませんでした。",
      "error",
    );
  });
trackVisit(id);
