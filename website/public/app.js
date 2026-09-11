const API_URL = "/api/models";

const els = {
  count: document.getElementById("count"),
  updatedAt: document.getElementById("updatedAt"),
  status: document.getElementById("status"),
  tableWrap: document.getElementById("tableWrap"),
  tbody: document.getElementById("tbody"),
  emptyMsg: document.getElementById("emptyMsg"),
  searchInput: document.getElementById("searchInput"),
  searchHint: document.getElementById("searchHint"),
  reloadBtn: document.getElementById("reloadBtn"),
};

let allModels = [];
let filtered = [];
let sortKey = "id";
let sortDir = "asc"; // asc | desc

function formatContextLength(n) {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "")) + "M";
  }
  if (n >= 1000) {
    const v = n / 1000;
    return (v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "")) + "K";
  }
  return String(n);
}

function formatUpdatedAt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    // UTC only as agreed: YYYY-MM-DD HH:MM UTC
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sortModels(list) {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortKey === "context_length") {
      const av = a.context_length;
      const bv = b.context_length;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    }
    const av = String(a[sortKey] ?? "").toLowerCase();
    const bv = String(b[sortKey] ?? "").toLowerCase();
    return av.localeCompare(bv) * dir;
  });
}

function applyFilter() {
  const q = els.searchInput.value.trim().toLowerCase();
  if (!q) {
    filtered = sortModels(allModels);
  } else {
    const matched = allModels.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
    filtered = sortModels(matched);
  }
  renderTable();
  els.searchHint.textContent = q ? `${filtered.length} of ${allModels.length}` : `${filtered.length} models`;
}

function renderTable() {
  els.tbody.innerHTML = "";
  if (filtered.length === 0) {
    els.tableWrap.hidden = true;
    // Distinguish between no data at all vs no search results
    if (allModels.length === 0) {
      els.emptyMsg.hidden = true;
    } else {
      els.emptyMsg.hidden = false;
    }
    return;
  }
  els.emptyMsg.hidden = true;
  els.tableWrap.hidden = false;
  const frag = document.createDocumentFragment();
  for (const m of filtered) {
    const tr = document.createElement("tr");
    const href = `https://openrouter.ai/${encodeURI(m.id)}`;
    tr.innerHTML = `
      <td class="cell-id"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.id)}</a></td>
      <td class="cell-name">${escapeHtml(m.name)}</td>
      <td class="cell-ctx">${escapeHtml(formatContextLength(m.context_length))}</td>
    `;
    frag.appendChild(tr);
  }
  els.tbody.appendChild(frag);
}

function updateSortIndicators() {
  for (const ind of document.querySelectorAll(".sort-ind")) {
    const key = ind.getAttribute("data-ind");
    if (key === sortKey) ind.textContent = sortDir === "asc" ? "▲" : "▼";
    else ind.textContent = "";
  }
}

function setStatus(text, variant) {
  els.status.textContent = text;
  els.status.hidden = false;
  if (variant === "error") els.status.setAttribute("data-variant", "error");
  else els.status.removeAttribute("data-variant");
}

function hideStatus() {
  els.status.hidden = true;
  els.status.textContent = "";
}

async function load() {
  setStatus("Loading…");
  els.tableWrap.hidden = true;
  els.emptyMsg.hidden = true;
  els.count.textContent = "—";
  els.updatedAt.textContent = "—";
  try {
    const res = await fetch(API_URL, { headers: { accept: "application/json" } });
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "data not yet available");
    }
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    allModels = Array.isArray(data.models) ? data.models : [];
    els.count.textContent = String(data.count ?? allModels.length);
    els.updatedAt.textContent = formatUpdatedAt(data.updatedAt);
    hideStatus();
    applyFilter();
  } catch (e) {
    allModels = [];
    filtered = [];
    els.count.textContent = "—";
    els.updatedAt.textContent = "—";
    els.tableWrap.hidden = true;
    els.emptyMsg.hidden = true;
    setStatus(`Data not yet available. Please try again later. (${escapeHtml(String(e.message || e))})`, "error");
    els.searchHint.textContent = "";
  }
}

// Events
els.searchInput.addEventListener("input", applyFilter);
els.reloadBtn.addEventListener("click", load);

for (const btn of document.querySelectorAll(".th-sort")) {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-sort");
    if (!key) return;
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortDir = "asc";
    }
    updateSortIndicators();
    applyFilter();
  });
}

updateSortIndicators();
load();
