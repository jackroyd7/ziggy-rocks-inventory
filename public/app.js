// Ziggy Rocks front end. Talks to the /api routes; all records live on the server.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (name, cls = "icon") => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
const newId = () => (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "").slice(0, 20);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (d, opts = { weekday: "short", day: "numeric", month: "short" }) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", opts) : "";
const fmtTime = iso => { if (!iso) return ""; const d = new Date(iso); const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); return d.toDateString() === new Date().toDateString() ? t : `${t}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`; };
const groupBy = (arr, k) => arr.reduce((m, x) => ((m[x[k] || "Other"] ||= []).push(x), m), {});
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

const ROOMS = ["Kitchen", "Living/dining room", "Cinema room", "Utility room", "Boot room (dry room)", "WC", "Bedroom 1 (master)", "Bedroom 2", "Bedroom 3", "Bedroom 4 (bunk room)", "Main bathroom", "Ensuites", "Study / sofa bed", "Balcony", "Office", "Outside", "General"];
const COND = ["Good", "Fair", "Poor", "Missing"];
const PRI = { high: 0, medium: 1, low: 2 };
const STATUS = [["open", "Open"], ["in-progress", "In progress"], ["resolved", "Resolved"]];

const S = { inventory: [], cleans: [], issues: [], checklists: [] };
let loaded = false;
const ui = { room: "All", search: "", issueFilter: "active", open: new Set(), onlyLeft: new Set(), defaultOpened: false };

/* ---------------- server ---------------- */
async function api(path, { method = "GET", body, raw, type } = {}) {
  const res = await fetch(path, {
    method, credentials: "same-origin",
    headers: raw ? { "content-type": type } : body ? { "content-type": "application/json" } : {},
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && path !== "/api/login") { showLogin(); throw new Error("Sign in to continue."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Check your connection and try again.");
  return data;
}

async function refresh() {
  const d = await api("/api/state");
  Object.assign(S, d); loaded = true;
  renderAll();
}

// Change one record: update the screen straight away, then save.
async function save(op, collection, id, data) {
  const listName = collection === "config" ? null : collection;
  if (listName) {
    const list = S[listName]; const i = list.findIndex(x => x.id === id);
    if (op === "delete") { if (i >= 0) list.splice(i, 1); }
    else if (op === "set") { const rec = { id, ...data }; i >= 0 ? (list[i] = rec) : list.push(rec); }
    else if (i >= 0) list[i] = { ...list[i], ...data };
  } else if (id === "template") S.checklists = data.checklists;
  renderAll();
  try { await api("/api/doc", { method: "POST", body: { op, collection, id, data } }); }
  catch (e) { toast(e.message); refresh().catch(() => {}); throw e; }
}

async function shrink(file, max = 1600, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((ok, fail) => c.toBlob(b => b ? ok(b) : fail(new Error("Couldn't read that photo.")), "image/jpeg", quality));
  } catch { throw new Error("Couldn't read that photo. Try a JPEG or PNG."); }
}
async function uploadPhoto(file) {
  const blob = await shrink(file);
  const { url } = await api("/api/photo", { method: "POST", raw: blob, type: "image/jpeg" });
  return url;
}
const deletePhoto = url => api("/api/photo?url=" + encodeURIComponent(url), { method: "DELETE" }).catch(() => {});
const toBase64 = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });

/* ---------------- small UI helpers ---------------- */
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3800); }
function openSheet(id) { const d = $(id); if (!d.open) d.showModal(); }
function closeSheet(el) { el.closest("dialog")?.close(); }
document.addEventListener("click", e => {
  if (e.target.closest("[data-close]")) closeSheet(e.target.closest("[data-close]"));
  const z = e.target.closest("[data-zoom]"); if (z) showPhoto(z.dataset.src || z.src);
  const go = e.target.closest("[data-go]"); if (go) location.hash = go.dataset.go;
});
$$("dialog.sheet, dialog.lightbox").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));
function showPhoto(src) { const d = $("#d-photo"); d.querySelector("img").src = src; d.showModal(); }
function segment(el, value) { el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === value))); el.dataset.value = value; }
$$(".seg[id]").forEach(el => el.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) segment(el, b.dataset.v); }));
function previews(files, el) { el.innerHTML = ""; for (const f of files) { const img = document.createElement("img"); img.src = URL.createObjectURL(f); img.alt = ""; el.append(img); } }
const thumb = (url, label = "") => url ? `<button class="thumb" data-zoom data-src="${esc(url)}" aria-label="View photo ${esc(label)}"><img src="${esc(url)}" alt="" loading="lazy"></button>` : `<div class="thumb">${icon("image")}</div>`;
// Don't redraw a list someone is typing in; catch up once they leave it.
const deferred = new Set();
function safely(container, fn) {
  const a = document.activeElement;
  if (a && container.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "checkbox"))) { deferred.add(fn); return; }
  fn();
}
document.addEventListener("focusout", () => setTimeout(() => { const fns = [...deferred]; deferred.clear(); fns.forEach(f => f()); }, 0));

/* ---------------- routing ---------------- */
const TABS = ["inventory", "cleaning", "issues"];
function route() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "inventory";
  $$(".tabs a").forEach(a => a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  TABS.forEach(t => ($("#v-" + t).hidden = t !== tab));
  $("#fab").hidden = tab !== "issues";
}
addEventListener("hashchange", () => { route(); scrollTo({ top: 0 }); });

/* ---------------- summary ---------------- */
function renderStats() {
  const total = S.inventory.reduce((n, i) => n + (Number(i.qty) || 0), 0);
  const rooms = new Set(S.inventory.map(i => i.room)).size;
  $("#st-items").textContent = total;
  $("#st-items-l").textContent = S.inventory.length ? `items in ${plural(rooms, "room")}` : "items so far";
  const active = activeCleans()[0];
  if (active) { const done = active.tasks.filter(t => t.done).length; $("#st-co").textContent = `${done}/${active.tasks.length}`; $("#st-co-l").textContent = "changeover tasks done"; }
  else if (S.cleans.length) { const last = sortedCleans()[0]; $("#st-co").textContent = fmtDate(last.date, { day: "numeric", month: "short" }); $("#st-co-l").textContent = "last changeover"; }
  else { $("#st-co").textContent = "0"; $("#st-co-l").textContent = "changeovers"; }
  const open = S.issues.filter(i => i.status !== "resolved"); const high = open.filter(i => i.priority === "high").length;
  $("#st-issues").textContent = open.length;
  $("#st-issues-l").textContent = high ? `open · ${high} high` : "open issues";
  $("#st-issues-tile").classList.toggle("warn", high > 0);
  const badge = $("#tab-badge"); badge.hidden = !open.length; badge.textContent = open.length;
}
function renderRooms() {
  const rooms = new Set([...ROOMS, ...S.inventory.map(i => i.room), ...S.checklists.flatMap(c => c.tasks.map(t => t.room)), ...S.issues.map(i => i.room)].filter(Boolean));
  $("#rooms").innerHTML = [...rooms].map(r => `<option value="${esc(r)}">`).join("");
}

/* ---------------- inventory ---------------- */
function renderInventory() {
  const box = $("#inv-list");
  const roomsWith = Object.entries(groupBy(S.inventory, "room")).sort(([a], [b]) => a.localeCompare(b));
  if (ui.room !== "All" && !roomsWith.some(([r]) => r === ui.room)) ui.room = "All";
  $("#room-chips").innerHTML = S.inventory.length ? [["All", S.inventory.length], ...roomsWith.map(([r, l]) => [r, l.length])]
    .map(([r, n]) => `<button class="chip" data-room="${esc(r)}" aria-pressed="${ui.room === r}">${esc(r)} <span class="c">${n}</span></button>`).join("") : "";
  if (!S.inventory.length) {
    box.innerHTML = `<div class="card empty">${icon("box")}<p><strong>Nothing in the inventory yet.</strong><br>Scan a cupboard to fill it quickly, or add items one at a time.</p></div>`;
    return;
  }
  const q = ui.search.trim().toLowerCase();
  const items = S.inventory.filter(i => (ui.room === "All" || i.room === ui.room) && (!q || `${i.item} ${i.room} ${i.notes}`.toLowerCase().includes(q)));
  if (!items.length) { box.innerHTML = `<div class="card empty">${icon("search")}<p>Nothing matches “${esc(ui.search)}”.</p></div>`; return; }
  box.innerHTML = Object.entries(groupBy(items, "room")).sort(([a], [b]) => a.localeCompare(b)).map(([room, list]) => `
    <section class="card room-card">
      <header><h3>${esc(room)}</h3><span class="muted" style="font-size:.85rem">${plural(list.reduce((n, i) => n + (Number(i.qty) || 0), 0), "item")}</span></header>
      <div class="items">${list.sort((a, b) => a.item.localeCompare(b.item)).map(i => `
        <div class="item" data-id="${esc(i.id)}">
          ${thumb(i.photo, i.item)}
          <button class="name" data-edit><strong>${esc(i.item)}</strong>
            <small>${i.condition && i.condition !== "Good" ? `<span class="tag ${i.condition === "Fair" ? "warn" : "bad"}">${esc(i.condition)}</span>` : ""}${i.notes ? `<span>${esc(i.notes)}</span>` : ""}${!i.notes && (!i.condition || i.condition === "Good") ? `<span>${i.checked ? "Checked " + esc(fmtDate(i.checked, { day: "numeric", month: "short" })) : "Tap to edit"}</span>` : ""}</small>
          </button>
          <div class="stepper"><button data-step="-1" aria-label="One fewer ${esc(i.item)}">${icon("minus")}</button><span>${Number(i.qty) || 0}</span><button data-step="1" aria-label="One more ${esc(i.item)}">${icon("plus")}</button></div>
        </div>`).join("")}</div>
    </section>`).join("");
}
$("#room-chips").addEventListener("click", e => { const c = e.target.closest("[data-room]"); if (c) { ui.room = c.dataset.room; renderInventory(); } });
$("#inv-search").addEventListener("input", e => { ui.search = e.target.value; renderInventory(); });
$("#inv-list").addEventListener("click", e => {
  const row = e.target.closest(".item"); if (!row) return; const it = S.inventory.find(i => i.id === row.dataset.id); if (!it) return;
  const step = e.target.closest("[data-step]");
  if (step) save("update", "inventory", it.id, { qty: Math.max(0, (Number(it.qty) || 0) + Number(step.dataset.step)) }).catch(() => {});
  if (e.target.closest("[data-edit]")) openItem(it);
});

// Item sheet
let editing = null, itemPhoto = null;
function openItem(it = null) {
  editing = it; itemPhoto = null;
  $("#item-title").textContent = it ? "Edit item" : "Add item";
  $("#it-item").value = it?.item || ""; $("#it-room").value = it?.room || (ui.room !== "All" ? ui.room : "");
  $("#it-qty").value = it?.qty ?? 1; $("#it-notes").value = it?.notes || ""; $("#it-checked").value = it?.checked || today();
  segment($("#it-cond"), it?.condition || "Good");
  $("#it-thumb").innerHTML = it?.photo ? `<img src="${esc(it.photo)}" alt="">` : icon("image");
  $("#it-photo").value = ""; $("#it-delete").hidden = !it;
  openSheet("#d-item"); if (!it) $("#it-item").focus();
}
$("#open-item").addEventListener("click", () => openItem());
$("#it-photo").addEventListener("change", e => { itemPhoto = e.target.files[0] || null; if (itemPhoto) $("#it-thumb").innerHTML = `<img src="${URL.createObjectURL(itemPhoto)}" alt="">`; });
$("#item-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#it-save"); btn.disabled = true;
  try {
    let photo = editing?.photo || null;
    if (itemPhoto) { btn.textContent = "Uploading…"; const old = photo; photo = await uploadPhoto(itemPhoto); if (old) deletePhoto(old); }
    const data = { item: $("#it-item").value.trim(), room: $("#it-room").value.trim(), qty: Math.max(0, Number($("#it-qty").value) || 0), condition: $("#it-cond").dataset.value || "Good", notes: $("#it-notes").value.trim(), checked: $("#it-checked").value, photo };
    if (editing) await save("update", "inventory", editing.id, data);
    else await save("set", "inventory", newId(), { ...data, createdAt: Date.now() });
    $("#d-item").close(); toast(editing ? "Saved." : `Added ${data.item}.`);
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = "Save"; }
});
$("#it-delete").addEventListener("click", async () => {
  if (!editing || !confirm(`Delete ${editing.item} from the inventory?`)) return;
  const it = editing; $("#d-item").close();
  await save("delete", "inventory", it.id).catch(() => {});
  if (it.photo && !S.inventory.some(o => o.photo === it.photo)) deletePhoto(it.photo);
  toast(`Deleted ${it.item}.`);
});

// Scan sheet
let scanFiles = [], scanRows = [], scanBusy = false;
function scanStep(step) {
  $("#scan-setup").hidden = step !== "setup"; $("#scan-wait").hidden = step !== "wait"; $("#scan-result").hidden = step !== "result";
  $("#scan-go").hidden = step !== "setup"; $("#scan-save").hidden = step !== "result"; $("#scan-again").hidden = step !== "result";
}
$("#open-scan").addEventListener("click", () => {
  if (!scanBusy) { scanFiles = []; $("#scan-files").value = ""; $("#scan-previews").innerHTML = ""; $("#scan-go").disabled = true; scanStep("setup"); if (ui.room !== "All") $("#scan-room").value = ui.room; }
  openSheet("#d-scan");
});
$("#scan-files").addEventListener("change", e => {
  scanFiles = [...e.target.files].slice(0, 5);
  if (e.target.files.length > 5) toast("Using the first 5 photos.");
  previews(scanFiles, $("#scan-previews")); $("#scan-go").disabled = !scanFiles.length;
});
$("#scan-again").addEventListener("click", () => { scanFiles = []; $("#scan-files").value = ""; $("#scan-previews").innerHTML = ""; $("#scan-go").disabled = true; scanStep("setup"); });
$("#scan-go").addEventListener("click", async () => {
  const room = $("#scan-room").value.trim();
  if (!room) { $("#scan-room").focus(); toast("Enter the room these photos show."); return; }
  scanBusy = true; scanStep("wait");
  try {
    const images = await Promise.all(scanFiles.map(async f => toBase64(await shrink(f, 1280, 0.8))));
    const existing = S.inventory.filter(i => i.room.toLowerCase() === room.toLowerCase());
    const { items } = await api("/api/scan", { method: "POST", body: { room, existing: existing.map(i => ({ item: i.item, qty: i.qty })), images } });
    scanRows = items.filter(x => x?.item).map(x => {
      const match = existing.find(i => i.item.toLowerCase() === String(x.item).toLowerCase());
      return { sel: true, item: String(x.item), qty: Math.max(0, Math.round(Number(x.qty) || 1)), condition: COND.includes(x.condition) ? x.condition : "Good", notes: String(x.notes || ""), match };
    });
    if (!scanRows.length) { toast("Claude couldn't find any inventory items. Try a closer, brighter photo."); scanStep("setup"); return; }
    $("#scan-summary").textContent = `Found ${plural(scanRows.length, "kind")} of item in ${room}. Untick anything wrong and fix the counts.`;
    renderScanRows(); scanStep("result");
  } catch (e) { toast(e.message); scanStep("setup"); }
  finally { scanBusy = false; }
});
function renderScanRows() {
  $("#scan-rows").innerHTML = scanRows.map((r, i) => `
    <div class="found-row" data-i="${i}">
      <input type="checkbox" data-k="sel"${r.sel ? " checked" : ""} aria-label="Include ${esc(r.item)}">
      <input type="text" data-k="item" value="${esc(r.item)}" aria-label="Item">
      <input type="number" data-k="qty" min="0" inputmode="numeric" value="${r.qty}" aria-label="Quantity">
      <div class="sub">
        <select data-k="condition" aria-label="Condition">${COND.slice(0, 3).map(c => `<option${c === r.condition ? " selected" : ""}>${c}</option>`).join("")}</select>
        ${r.match ? `<span class="tag warn">Listed with ${esc(r.match.qty)} · will update</span>` : `<span class="tag good">New</span>`}
        ${r.notes ? `<span>${esc(r.notes)}</span>` : ""}
      </div>
    </div>`).join("");
}
$("#scan-rows").addEventListener("input", e => {
  const r = scanRows[e.target.closest("[data-i]").dataset.i]; const k = e.target.dataset.k;
  r[k] = k === "sel" ? e.target.checked : k === "qty" ? Math.max(0, Number(e.target.value) || 0) : e.target.value;
});
$("#scan-save").addEventListener("click", async () => {
  const room = $("#scan-room").value.trim(); const chosen = scanRows.filter(r => r.sel && r.item.trim());
  if (!chosen.length) { toast("Tick at least one item to add."); return; }
  const btn = $("#scan-save"); btn.disabled = true; btn.textContent = "Saving…";
  let photo = null;
  try { photo = await uploadPhoto(scanFiles[0]); } catch { toast("The photo didn't upload, but the items will still be added."); }
  let added = 0, updated = 0;
  try {
    for (const r of chosen) {
      if (r.match) { const patch = { qty: r.qty, condition: r.condition, checked: today() }; if (photo && !r.match.photo) patch.photo = photo; await save("update", "inventory", r.match.id, patch); updated++; }
      else { await save("set", "inventory", newId(), { room, item: r.item.trim(), qty: r.qty, condition: r.condition, notes: r.notes, checked: today(), photo, createdAt: Date.now() }); added++; }
    }
    $("#d-scan").close(); ui.room = room; renderInventory();
    toast(`${added ? `Added ${added}` : ""}${added && updated ? " and " : ""}${updated ? `updated ${updated}` : ""} in ${room}.`.replace(/^u/, "U"));
  } catch {} finally { btn.disabled = false; btn.textContent = "Add to inventory"; }
});

/* ---------------- changeovers ---------------- */
const sortedCleans = () => [...S.cleans].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
const activeCleans = () => sortedCleans().filter(c => !c.finishedAt);
function ring(done, total, state) {
  const r = 24, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return `<div class="ring ${state}"><svg viewBox="0 0 56 56"><circle class="track" cx="28" cy="28" r="${r}"/><circle class="bar" cx="28" cy="28" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><span>${Math.round(pct * 100)}%</span></div>`;
}
function renderStarts() {
  $("#starts").innerHTML = S.checklists.length ? S.checklists.map(c => `
    <button class="start" data-start="${esc(c.id)}"><span class="glyph">${icon(c.id === "guest-to-owner" ? "home" : "key")}</span><span><strong>${esc(c.name)}</strong><small>${plural(c.tasks.length, "task")}</small></span></button>`).join("")
    : `<p class="muted" style="margin:0">No checklists yet. Add tasks under Edit checklists.</p>`;
}
function coCard(c) {
  const tasks = c.tasks || []; const done = tasks.filter(t => t.done).length; const left = tasks.length - done;
  const finished = !!c.finishedAt; const open = ui.open.has(c.id); const only = ui.onlyLeft.has(c.id);
  const state = !left ? "done" : finished ? "missed" : "";
  const status = !left ? `<span class="tag good">All done</span>` : finished ? `<span class="tag bad">${left} missed</span>` : `<span class="tag warn">${left} to do</span>`;
  let body = "";
  if (open) {
    const rooms = Object.entries(groupBy(tasks.map((t, i) => ({ ...t, i })), "room")).map(([room, ts]) => {
      const rl = ts.filter(t => !t.done).length; const shown = only ? ts.filter(t => !t.done) : ts;
      if (!shown.length) return "";
      return `<div class="room"><div class="room-head"><h4>${esc(room)}</h4><span class="c ${rl ? "left" : "complete"}">${rl ? `${ts.length - rl} of ${ts.length}` : "Done"}</span></div>
        ${shown.map(t => `<button class="task${!t.done && finished ? " missed" : ""}" role="checkbox" aria-checked="${!!t.done}" data-i="${t.i}">
          <span class="box">${icon("check")}</span><span class="t">${esc(t.task)}</span>
          <span class="when">${t.done && t.doneAt ? esc(fmtTime(t.doneAt)) : !t.done && finished ? "Missed" : ""}</span></button>`).join("")}</div>`;
    }).join("");
    body = `<div class="co-body">
      <div class="co-tools">
        <div class="seg" role="group" aria-label="Show"><button data-only="0" aria-pressed="${!only}">All tasks</button><button data-only="1" aria-pressed="${only}">Not done (${left})</button></div>
        ${finished ? `<span class="row"><span class="muted" style="font-size:.88rem">Finished ${esc(fmtTime(c.finishedAt))}</span><button class="btn ghost small" data-reopen>Reopen</button></span>` : ""}
      </div>
      ${rooms || `<div class="empty" style="padding:16px">${icon("check")}<p>Every task is ticked.</p></div>`}
      <label class="field"><span>Notes from this changeover</span><textarea data-notes placeholder="Anything to report? Log damage or repairs in Issues too.">${esc(c.notes)}</textarea></label>
      <div class="row between">
        <button class="btn ghost danger small" data-del>${icon("trash")}Delete</button>
        ${finished ? "" : `<button class="btn primary" data-finish>${left ? "Finish changeover" : "Finish · all done"}</button>`}
      </div>
    </div>`;
  }
  const notDone = tasks.filter(t => !t.done);
  const missing = !open && left && (finished || c.date < today()) ? `<ul class="missing">${notDone.slice(0, 4).map(t => `<li><span>${esc(t.task)} <small>· ${esc(t.room)}</small></span></li>`).join("")}${notDone.length > 4 ? `<li><small>and ${notDone.length - 4} more. Open it to see them all.</small></li>` : ""}</ul>` : "";
  return `<article class="card changeover" data-id="${esc(c.id)}">
    <div class="co-head" data-toggle role="button" tabindex="0" aria-expanded="${open}">
      ${ring(done, tasks.length, state)}
      <div style="min-width:0"><h3>${esc(c.type || "Changeover")}</h3><div class="meta"><span>${esc(fmtDate(c.date, { weekday: "long", day: "numeric", month: "long" }))}</span>${c.by ? `<span>· ${esc(c.by)}</span>` : ""}${status}</div></div>
      <span class="btn ghost small" aria-hidden="true">${open ? "Hide" : "Open"}</span>
    </div>
    ${body}${missing}
  </article>`;
}
function renderCleaning() {
  renderStarts();
  const active = activeCleans(); const history = sortedCleans().filter(c => c.finishedAt);
  if (!ui.defaultOpened && loaded) { if (active[0]) ui.open.add(active[0].id); ui.defaultOpened = true; }
  $("#co-active").innerHTML = active.length ? active.map(coCard).join("")
    : `<div class="card empty">${icon("list")}<p><strong>No changeover in progress.</strong><br>Pick a checklist above. Each task gets a tickbox and every tick is logged with the time.</p></div>`;
  $("#co-history-title").hidden = !history.length;
  $("#co-history").innerHTML = history.map(coCard).join("");
}
function coFromEvent(e) { const card = e.target.closest(".changeover"); return card && S.cleans.find(c => c.id === card.dataset.id); }
for (const sel of ["#co-active", "#co-history"]) {
  $(sel).addEventListener("click", async e => {
    const c = coFromEvent(e); if (!c) return;
    if (e.target.closest("[data-toggle]")) { ui.open.has(c.id) ? ui.open.delete(c.id) : ui.open.add(c.id); renderCleaning(); return; }
    const only = e.target.closest("[data-only]"); if (only) { only.dataset.only === "1" ? ui.onlyLeft.add(c.id) : ui.onlyLeft.delete(c.id); renderCleaning(); return; }
    const task = e.target.closest(".task");
    if (task) {
      const i = Number(task.dataset.i); const now = new Date().toISOString();
      const tasks = c.tasks.map((t, j) => j === i ? { ...t, done: !t.done, doneAt: !t.done ? now : null } : t);
      save("update", "cleans", c.id, { tasks }).catch(() => {});
      if (navigator.vibrate && !c.tasks[i].done) navigator.vibrate(8);
      return;
    }
    if (e.target.closest("[data-finish]")) {
      const left = c.tasks.filter(t => !t.done).length;
      if (left && !confirm(`${plural(left, "task")} not ticked. Finish anyway? They'll be marked as missed.`)) return;
      await save("update", "cleans", c.id, { finishedAt: new Date().toISOString() }).catch(() => {});
      ui.open.delete(c.id); renderCleaning(); toast(left ? `Finished with ${plural(left, "task")} missed.` : "Changeover finished. Every task done.");
    }
    if (e.target.closest("[data-reopen]")) save("update", "cleans", c.id, { finishedAt: null }).catch(() => {});
    if (e.target.closest("[data-del]") && confirm(`Delete the ${c.type || "changeover"} from ${fmtDate(c.date)}?`)) save("delete", "cleans", c.id).catch(() => {});
  });
  $(sel).addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-toggle]")) { e.preventDefault(); e.target.click(); } });
  $(sel).addEventListener("change", e => { const c = coFromEvent(e); if (c && e.target.matches("[data-notes]")) save("update", "cleans", c.id, { notes: e.target.value }).catch(() => {}); });
}
$("#starts").addEventListener("click", e => {
  const b = e.target.closest("[data-start]"); if (!b) return;
  $("#start-choice").innerHTML = S.checklists.map(c => `<label><input type="radio" name="cl" value="${esc(c.id)}"${c.id === b.dataset.start ? " checked" : ""}><span><strong>${esc(c.name)}</strong><small>${plural(c.tasks.length, "task")}</small></span></label>`).join("");
  $("#start-date").value = today(); $("#start-by").value = store.get("zr-name") || "";
  openSheet("#d-start");
});
$("#start-form").addEventListener("submit", async e => {
  e.preventDefault();
  const cl = S.checklists.find(c => c.id === new FormData(e.target).get("cl")); if (!cl) return;
  const by = $("#start-by").value.trim(); if (by) store.set("zr-name", by);
  const id = newId(); ui.open.add(id); $("#d-start").close();
  await save("set", "cleans", id, { type: cl.name, date: $("#start-date").value || today(), by, notes: "", createdAt: Date.now(), tasks: cl.tasks.map(t => ({ room: t.room, task: t.task, done: false })) }).catch(() => {});
  document.querySelector(`.changeover[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Checklist editor
let tplWhich = null;
function renderTpl() {
  if (!S.checklists.some(c => c.id === tplWhich)) tplWhich = S.checklists[0]?.id;
  $("#tpl-which").innerHTML = S.checklists.map(c => `<button type="button" data-v="${esc(c.id)}" aria-pressed="${c.id === tplWhich}">${esc(c.name.replace(" → ", " → "))}</button>`).join("");
  const cl = S.checklists.find(c => c.id === tplWhich);
  $("#tpl-list").innerHTML = cl?.tasks.length ? Object.entries(groupBy(cl.tasks, "room")).map(([room, ts]) => `
    <div class="tpl-room"><div class="room-head"><h4>${esc(room)}</h4></div>${ts.map(t => `<div class="tpl-task" data-id="${esc(t.id)}"><span>${esc(t.task)}</span><button class="btn ghost small danger" data-remove aria-label="Remove ${esc(t.task)}">${icon("x")}</button></div>`).join("")}</div>`).join("")
    : `<p class="muted">No tasks in this checklist yet.</p>`;
}
$("#open-tpl").addEventListener("click", () => { renderTpl(); openSheet("#d-tpl"); });
$("#tpl-which").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { tplWhich = b.dataset.v; renderTpl(); } });
const saveChecklists = list => save("set", "config", "template", { checklists: list }).catch(() => {});
$("#tpl-list").addEventListener("click", e => {
  if (!e.target.closest("[data-remove]")) return; const id = e.target.closest("[data-id]").dataset.id;
  saveChecklists(S.checklists.map(c => c.id === tplWhich ? { ...c, tasks: c.tasks.filter(t => t.id !== id) } : c)).then(renderTpl);
});
$("#tpl-form").addEventListener("submit", e => {
  e.preventDefault(); const room = $("#tpl-room").value.trim(), task = $("#tpl-task").value.trim(); if (!room || !task) return;
  saveChecklists(S.checklists.map(c => c.id === tplWhich ? { ...c, tasks: [...c.tasks, { id: newId(), room, task }] } : c)).then(renderTpl);
  $("#tpl-task").value = ""; $("#tpl-task").focus();
});
$("#open-plans").addEventListener("click", () => openSheet("#d-plans"));

/* ---------------- issues ---------------- */
function renderIssues() {
  const counts = { active: 0, "in-progress": 0, resolved: 0, all: S.issues.length };
  for (const i of S.issues) { if (i.status !== "resolved") counts.active++; if (i.status === "in-progress") counts["in-progress"]++; if (i.status === "resolved") counts.resolved++; }
  $("#issue-chips").innerHTML = [["active", "Open"], ["in-progress", "In progress"], ["resolved", "Resolved"], ["all", "All"]]
    .map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${ui.issueFilter === k}">${l} <span class="c">${counts[k]}</span></button>`).join("");
  const list = S.issues.filter(i => ui.issueFilter === "all" || (ui.issueFilter === "active" ? i.status !== "resolved" : i.status === ui.issueFilter))
    .sort((a, b) => (a.status === "resolved") - (b.status === "resolved") || (PRI[a.priority] ?? 1) - (PRI[b.priority] ?? 1) || (b.date || "").localeCompare(a.date || ""));
  const box = $("#issue-list");
  if (!list.length) { box.innerHTML = `<div class="card empty">${icon("check")}<p>${S.issues.length ? "Nothing here." : "<strong>No issues logged.</strong><br>Log anything that needs fixing, replacing or deciding."}</p></div>`; return; }
  box.innerHTML = list.map(i => `
    <article class="card issue p-${esc(i.priority)} s-${esc(i.status)}" data-id="${esc(i.id)}">
      <div class="in">
        <div><h3>${esc(i.title)}</h3>
          <div class="meta">${i.room ? `<span>${esc(i.room)}</span><span>·</span>` : ""}<span class="tag ${i.priority === "high" ? "bad" : i.priority === "medium" ? "warn" : ""}">${esc(i.priority)} priority</span><span>· ${esc(fmtDate(i.date, { day: "numeric", month: "short" }))}</span>${i.resolved ? `<span class="tag good">Resolved ${esc(fmtDate(i.resolved, { day: "numeric", month: "short" }))}</span>` : ""}</div></div>
        ${i.notes ? `<p class="notes">${esc(i.notes)}</p>` : ""}
        <div class="photos">${(i.photos || []).map(p => thumb(p, i.title)).join("")}<label class="addphoto">${icon("camera")}<input type="file" accept="image/*" multiple data-addphoto aria-label="Add photos to ${esc(i.title)}"></label></div>
        <div class="row between">
          <div class="seg" role="group" aria-label="Status">${STATUS.map(([v, l]) => `<button data-status="${v}" aria-pressed="${i.status === v}">${l}</button>`).join("")}</div>
          <button class="btn ghost small danger" data-del aria-label="Delete ${esc(i.title)}">${icon("trash")}</button>
        </div>
      </div>
    </article>`).join("");
}
$("#issue-chips").addEventListener("click", e => { const c = e.target.closest("[data-f]"); if (c) { ui.issueFilter = c.dataset.f; renderIssues(); } });
$("#issue-list").addEventListener("click", e => {
  const card = e.target.closest(".issue"); if (!card) return; const it = S.issues.find(i => i.id === card.dataset.id); if (!it) return;
  const st = e.target.closest("[data-status]");
  if (st && st.dataset.status !== it.status) save("update", "issues", it.id, { status: st.dataset.status, resolved: st.dataset.status === "resolved" ? today() : "" }).then(() => st.dataset.status === "resolved" && toast("Marked as resolved.")).catch(() => {});
  if (e.target.closest("[data-del]") && confirm(`Delete “${it.title}”?`)) { save("delete", "issues", it.id).catch(() => {}); (it.photos || []).forEach(deletePhoto); }
});
$("#issue-list").addEventListener("change", async e => {
  if (!e.target.matches("[data-addphoto]")) return;
  const it = S.issues.find(i => i.id === e.target.closest(".issue").dataset.id); const files = [...e.target.files]; if (!it || !files.length) return;
  toast(`Uploading ${plural(files.length, "photo")}…`);
  const urls = []; for (const f of files) { try { urls.push(await uploadPhoto(f)); } catch (err) { toast(err.message); } }
  if (urls.length) save("update", "issues", it.id, { photos: [...(it.photos || []), ...urls] }).then(() => toast("Photos added.")).catch(() => {});
});
let issueFiles = [];
function openIssue() {
  $("#issue-form").reset(); $("#is-date").value = today(); segment($("#is-pri"), "medium"); issueFiles = []; $("#is-previews").innerHTML = "";
  openSheet("#d-issue"); $("#is-title").focus();
}
$("#open-issue").addEventListener("click", openIssue);
$("#fab").addEventListener("click", openIssue);
$("#is-files").addEventListener("change", e => { issueFiles = [...e.target.files].slice(0, 8); previews(issueFiles, $("#is-previews")); });
$("#issue-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#is-save"); btn.disabled = true;
  try {
    const photos = [];
    if (issueFiles.length) { btn.textContent = "Uploading photos…"; for (const f of issueFiles) { try { photos.push(await uploadPhoto(f)); } catch (err) { toast(err.message); } } }
    await save("set", "issues", newId(), { title: $("#is-title").value.trim(), room: $("#is-room").value.trim(), priority: $("#is-pri").dataset.value || "medium", date: $("#is-date").value || today(), notes: $("#is-notes").value.trim(), status: "open", resolved: "", photos, createdAt: Date.now() });
    $("#d-issue").close(); ui.issueFilter = "active"; renderIssues(); toast("Issue logged.");
  } catch {} finally { btn.disabled = false; btn.textContent = "Log issue"; }
});

/* ---------------- boot ---------------- */
function renderAll() {
  if (!loaded) return;
  renderStats(); renderRooms();
  safely($("#v-inventory"), renderInventory);
  safely($("#v-cleaning"), renderCleaning);
  safely($("#v-issues"), renderIssues);
  if ($("#d-tpl").open) renderTpl();
}
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; setTimeout(() => $("#login-pw").focus(), 50); }
async function showApp() {
  $("#login").hidden = true; $("#app").hidden = false; route();
  try { await refresh(); } catch (e) { if ($("#login").hidden) toast(e.message); }
}
document.querySelectorAll(".top, .login").forEach(el => el.prepend($("#strata-tpl").content.cloneNode(true)));
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault(); $("#login-err").textContent = ""; const btn = $("#login-btn"); btn.disabled = true;
  try { await api("/api/login", { method: "POST", body: { password: $("#login-pw").value } }); $("#login-pw").value = ""; showApp(); }
  catch (err) { $("#login-err").textContent = err.message; }
  finally { btn.disabled = false; }
});
$("#signout").addEventListener("click", async () => { await api("/api/login", { method: "DELETE" }).catch(() => {}); loaded = false; showLogin(); });
// Keep everyone's phones up to date.
const anySheetOpen = () => $$("dialog").some(d => d.open);
setInterval(() => { if (!document.hidden && loaded && !anySheetOpen()) refresh().catch(() => {}); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && loaded) refresh().catch(() => {}); });

api("/api/login").then(r => r.signedIn ? showApp() : showLogin()).catch(() => showLogin());
