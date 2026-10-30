import "./style.css";
import { api, DEMO, download, toCsv, type Job, type Point, type Rally, type RallyStatus, type Result, type Review, type Shot, type Team } from "./api";
import { replay } from "./score";

/* ------------------------------------------------------------------ helpers */
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (t: number) => { const m = Math.floor(t / 60); const s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
const fmtDur = (t: number) => { const m = Math.floor(t / 60); const s = Math.round(t - m * 60); return m ? `${m}m ${s}s` : `${s}s`; };
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const app = $("#app");

export const SHOT_TYPES = ["serve", "return", "third shot", "drop", "dink", "drive", "volley", "lob", "smash", "reset", "other"] as const;
const SHOT_COLORS: Record<string, string> = {
  serve: "#ff7aa2", return: "#ffb347", "third shot": "#a78bfa", drop: "#60a5fa", dink: "#34d399",
  drive: "#f87171", volley: "#fbbf24", lob: "#38bdf8", smash: "#ef4444", reset: "#94a3b8", other: "#cbd5e1",
};
const SHOT_EMOJI: Record<string, string> = {
  serve: "🎯", return: "↩️", "third shot": "3️⃣", drop: "🪶", dink: "🤏", drive: "💥", volley: "⚡", lob: "🌈",
  smash: "🔨", reset: "🧘", other: "•",
};
const PRESETS: Record<string, string> = { strict: "Strict", balanced: "Balanced", sensitive: "Sensitive" };

function header(active: "home" | "job") {
  return `
  <header class="topbar">
    <a class="brand" href="#/"><span class="ball">🏓</span><span>Dink<b>Lab</b></span><small>pickleball analyzer</small></a>
    <nav>
      ${DEMO ? `<a href="https://github.com/melloo21/pickleball-analyzer" target="_blank" rel="noopener">⭐ GitHub</a>` : `
      <a href="#/" class="${active === "home" ? "on" : ""}">⬆️ Upload</a>
      <a href="#/library">📚 Library</a>`}
    </nav>
  </header>
  ${DEMO ? `<div class="demo-bar">🧪 <b>Live demo</b>: one pre-analysed match, no uploads. Your review edits stay in this browser.
    <a href="https://github.com/melloo21/pickleball-analyzer#run" target="_blank" rel="noopener">Run it locally</a> to analyse your own videos.</div>` : ""}`;
}

/* ------------------------------------------------------------------ router */
let cleanup: (() => void) | null = null;
let viewAC = new AbortController();          // every listener on app/window is tied to the current view
const on = { get signal() { return viewAC.signal; } };
function route() {
  cleanup?.(); cleanup = null;
  viewAC.abort(); viewAC = new AbortController();
  const h = location.hash || "#/";
  if (DEMO) return jobView("demo");          // the static demo is just the one sample workspace
  const m = h.match(/^#\/job\/([\w-]+)/);
  if (m) return jobView(m[1]);
  return homeView(h.startsWith("#/library"));
}
window.addEventListener("hashchange", route);
route();

/* ================================================================== HOME: upload + library */
async function homeView(scrollToLibrary: boolean) {
  app.innerHTML = `
  ${header("home")}
  <main class="home">
    <section class="hero">
      <div>
        <h1>Every rally. Every shot.<br/><span class="hl">Timestamped.</span></h1>
        <p>Drop in a match video. Dink Lab listens for the <i>pop</i> of the paddle, watches the court,
           and hands you a clickable map of rallies, shots and points to review.</p>
        <div class="howto">
          <div><span>1</span>Upload a video</div>
          <div><span>2</span>We tag rallies &amp; shots</div>
          <div><span>3</span>You check &amp; score</div>
        </div>
      </div>
      <form class="upload card" id="upform">
        <label class="drop" id="drop">
          <input type="file" id="file" accept="video/*,.mkv,.webm" hidden />
          <div class="drop-inner" id="dropInner">
            <div class="drop-ball">🎾</div>
            <b>Drag &amp; drop a match video</b>
            <span>or <u>browse files</u> · mp4, mov, webm, mkv · up to 4 GB</span>
          </div>
        </label>
        <div class="row2">
          <label class="fld"><span>🟢 Team A (near side)</span><input name="team_a" value="Team A" maxlength="30"/></label>
          <label class="fld"><span>🔵 Team B (far side)</span><input name="team_b" value="Team B" maxlength="30"/></label>
        </div>
        <div class="row2">
          <div class="fld"><span>Scoring</span>
            <div class="seg" data-name="scoring">
              <button type="button" data-v="sideout" class="on">Side-out</button>
              <button type="button" data-v="rally">Rally</button>
            </div>
          </div>
          <div class="fld"><span>Detection sensitivity</span>
            <div class="seg" data-name="preset">
              <button type="button" data-v="strict">Strict</button>
              <button type="button" data-v="balanced" class="on">Balanced</button>
              <button type="button" data-v="sensitive">Sensitive</button>
            </div>
          </div>
        </div>
        <div class="upbar hidden" id="upbar"><div></div><span>0%</span></div>
        <button class="btn primary big" id="go" disabled>🚀 Upload &amp; analyze</button>
        <p class="err" id="uperr"></p>
      </form>
    </section>

    <section class="library" id="library">
      <div class="sec-h"><h2>📚 Your analyses</h2><span class="muted" id="libcount"></span></div>
      <div class="grid" id="jobs"><div class="muted">Loading…</div></div>
    </section>
  </main>`;

  // segmented controls
  const choice: Record<string, string> = { scoring: "sideout", preset: "balanced" };
  app.querySelectorAll<HTMLElement>(".seg").forEach((seg) =>
    seg.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button"); if (!b) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      choice[seg.dataset.name!] = b.dataset.v!;
    }));

  // file pick / drag-drop
  let file: File | null = null;
  const input = $<HTMLInputElement>("#file"), drop = $("#drop"), go = $<HTMLButtonElement>("#go");
  const pick = (f?: File | null) => {
    if (!f) return;
    file = f; go.disabled = false;
    $("#dropInner").innerHTML = `<div class="drop-ball spin">🎾</div><b>${esc(f.name)}</b><span>${mb(f.size)} · <span id="vdur">reading…</span> · <u>change</u></span>`;
    const v = document.createElement("video"); v.preload = "metadata"; v.src = URL.createObjectURL(f);
    v.onloadedmetadata = () => { const d = $("#vdur"); if (d) d.textContent = `${fmtDur(v.duration)} · ${v.videoWidth}×${v.videoHeight}`; URL.revokeObjectURL(v.src); };
    v.onerror = () => { const d = $("#vdur"); if (d) d.textContent = "will be converted for playback"; };
  };
  input.addEventListener("change", () => pick(input.files?.[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => pick((e as DragEvent).dataTransfer?.files?.[0]));

  $("#upform").addEventListener("submit", async (e) => {
    e.preventDefault(); if (!file) return;
    const fd = new FormData(e.target as HTMLFormElement);
    const bar = $("#upbar"); bar.classList.remove("hidden"); go.disabled = true; go.textContent = "⏫ Uploading…";
    $("#uperr").textContent = "";
    try {
      const { id } = await api.upload(file, {
        team_a: String(fd.get("team_a")), team_b: String(fd.get("team_b")), ...choice,
      }, (f) => { ($("div", bar) as HTMLElement).style.width = `${f * 100}%`; $("span", bar).textContent = `${Math.round(f * 100)}%`; });
      location.hash = `#/job/${id}`;
    } catch (err) {
      $("#uperr").textContent = `😿 ${(err as Error).message}`; go.disabled = false; go.textContent = "🚀 Upload & analyze";
    }
  });

  // library with live progress
  const loadJobs = async () => {
    const jobs = await api.jobs().catch(() => [] as Job[]);
    const el = $("#jobs"); if (!el) return;
    $("#libcount").textContent = jobs.length ? `${jobs.length} video${jobs.length > 1 ? "s" : ""}` : "";
    el.innerHTML = jobs.length ? jobs.map(jobCard).join("") : `<div class="empty card">No videos yet — upload your first match above 👆</div>`;
    return jobs.some((j) => j.state === "queued" || j.state === "running");
  };
  let timer = 0;
  const tick = async () => { if (await loadJobs()) timer = window.setTimeout(tick, 1500); };
  tick();
  app.addEventListener("click", async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-del]"); if (!b) return;
    e.preventDefault();
    if (confirm("Delete this analysis and its uploaded video?")) { await api.remove(b.dataset.del!); loadJobs(); }
  }, on);
  cleanup = () => clearTimeout(timer);
  if (scrollToLibrary) setTimeout(() => $("#library")?.scrollIntoView({ behavior: "smooth" }), 50);
}

function jobCard(j: Job) {
  const s = j.summary;
  const badge = { queued: "⏳ Queued", running: "⚙️ Analyzing", done: "✅ Ready", error: "⚠️ Error" }[j.state];
  return `
  <a class="jobcard card" href="#/job/${j.id}">
    <div class="jc-thumb">${j.state === "done" && s?.rallies ? `<img src="${api.thumbUrl(j.id, 1)}" loading="lazy"/>` : `<div class="jc-ph">🏓</div>`}
      <span class="pill ${j.state}">${badge}</span></div>
    <div class="jc-body">
      <b title="${esc(j.name)}">${esc(j.name)}</b>
      <small>${new Date(j.created * 1000).toLocaleString()} · ${mb(j.size_bytes)}</small>
      <small>${esc(j.teams.A)} vs ${esc(j.teams.B)} · ${j.scoring === "rally" ? "rally" : "side-out"} scoring</small>
      ${j.state === "done" && s ? `<div class="mini">
          <span>🏓 <b>${s.rallies}</b> rallies</span><span>🎾 <b>${s.shots}</b> shots</span><span>⏱ ${fmtDur(s.duration_s)}</span></div>`
        : j.state === "error" ? `<small class="err">${esc(j.error ?? "")}</small>`
        : `<div class="pbar"><div style="width:${j.progress * 100}%"></div></div><small>${esc(j.stage)}</small>`}
    </div>
    <button class="icon-btn" data-del="${j.id}" title="Delete">🗑</button>
  </a>`;
}

/* ================================================================== JOB: progress then workspace */
const STEPS = [
  ["Checking video", "📼"], ["Converting video for the browser", "🔄"], ["Extracting audio", "🎧"],
  ["Detecting paddle hits", "👂"], ["Scanning video frames", "👀"], ["Finding rallies", "🧩"],
  ["Tagging shots", "🏷"], ["Making rally thumbnails", "🖼"],
] as const;

async function jobView(id: string) {
  app.innerHTML = `${header("job")}<main class="loading"><div class="bounce">🎾</div></main>`;
  let timer = 0;
  const poll = async () => {
    let data;
    try { data = await api.job(id); } catch { app.innerHTML = `${header("job")}<main class="center"><div class="card empty">😿 Analysis not found. <a href="#/">Back</a></div></main>`; return; }
    if (data.job.state === "done" && data.result) return workspace(data.job, data.result, data.review);
    progressScreen(data.job);
    if (data.job.state !== "error") timer = window.setTimeout(poll, 800);
  };
  cleanup = () => clearTimeout(timer);
  poll();
}

function progressScreen(j: Job) {
  const idx = STEPS.findIndex(([s]) => j.stage.startsWith(s));
  app.innerHTML = `
  ${header("job")}
  <main class="center">
    <div class="card progress-card">
      <div class="court-anim"><div class="net"></div><div class="pb">🎾</div></div>
      <h2>${j.state === "error" ? "😿 Something went wrong" : j.state === "queued" ? "⏳ Waiting in line…" : "Analyzing your match…"}</h2>
      <p class="muted">${esc(j.name)}</p>
      <div class="pbar big"><div style="width:${Math.max(2, j.progress * 100)}%"></div></div>
      <p><b>${Math.round(j.progress * 100)}%</b> · ${esc(j.stage)}</p>
      <ol class="steps">${STEPS.map(([s, e], i) =>
        `<li class="${i < idx ? "done" : i === idx ? "now" : ""}"><span>${i < idx ? "✅" : e}</span>${s}</li>`).join("")}</ol>
      ${j.error ? `<pre class="err">${esc(j.error)}</pre><a class="btn" href="#/">⬅ Back</a>` : ""}
    </div>
  </main>`;
}

/* ------------------------------------------------------------------ workspace state */
interface WS {
  job: Job; res: Result;
  rallies: Rally[]; shots: Shot[]; points: Point[];
  firstServer: Team;
  cur: number | null;        // current rally id
  curShot: string | null;
  loop: boolean; zoom: boolean;
  filter: Set<string>;
}

function workspace(job: Job, res: Result, review: Review) {
  const base = (l: string) => l.replace(" (rally end)", "");
  const S: WS = {
    job, res,
    rallies: (review.rallies ?? res.rallies).map((r) => ({ ...r, status: r.status ?? "unchecked" })),
    shots: (review.shots ?? res.shots).map((s) => ({ ...s, label: base(s.label) })),
    points: review.points ?? res.points,
    firstServer: review.firstServer ?? "A",
    cur: null, curShot: null, loop: false, zoom: false, filter: new Set(),
  };
  const T = job.teams;

  app.innerHTML = `
  ${header("job")}
  <main class="ws">
    <section class="ws-head">
      <div>
        ${DEMO ? "" : `<a href="#/library" class="back">⬅ Library</a>`}
        <h1 title="${esc(job.name)}">${esc(job.name)}</h1>
        <div class="chips">
          <span class="chip">🟢 ${esc(T.A)} <i>vs</i> 🔵 ${esc(T.B)}</span>
          <span class="chip">${job.scoring === "rally" ? "Rally scoring" : "Side-out scoring"}</span>
          <span class="chip">🎚 ${PRESETS[job.preset] ?? job.preset}</span>
          <span class="chip">📼 ${res.video.width}×${res.video.height} · ${res.video.fps} fps · ${fmtDur(res.video.duration)}</span>
          <span class="chip saved" id="saved">${DEMO ? "💾 Saved in browser" : "💾 Saved"}</span>
        </div>
      </div>
      <div class="actions">
        ${DEMO ? `<button class="btn" data-a="exportCsv">📄 CSV</button>
        <button class="btn" data-a="exportJson">🧾 JSON</button>
        <button class="btn" data-a="resetDemo" title="Undo your edits and go back to the original review">↺ Reset</button>` : `
        <a class="btn" href="/api/jobs/${job.id}/export.csv">📄 CSV</a>
        <a class="btn" href="/api/jobs/${job.id}/export.json">🧾 JSON</a>
        <select class="btn" id="re"><option value="">🔁 Re-analyze…</option>${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`}
      </div>
    </section>

    <section class="stats" id="stats"></section>

    <section class="ws-grid">
      <div class="ws-left">
        <div class="player card">
          <video id="vid" src="${api.videoUrl(job.id)}" controls preload="auto" playsinline></video>
          <div class="hud" id="hud"></div>
        </div>
        <div class="controls card">
          <button class="btn round" data-a="prevRally" title="Previous rally (J)">⏮</button>
          <button class="btn round" data-a="prevShot" title="Previous shot (←)">◀</button>
          <button class="btn primary" data-a="playRally" title="Play rally (P)">▶ Play rally</button>
          <button class="btn round" data-a="nextShot" title="Next shot (→)">▶</button>
          <button class="btn round" data-a="nextRally" title="Next rally (K)">⏭</button>
          <span class="sep"></span>
          <button class="btn toggle" data-a="loop" id="loopBtn" title="Loop current rally (L)">🔁 Loop</button>
          <button class="btn toggle" data-a="zoom" id="zoomBtn" title="Zoom timeline to rally (Z)">🔍 Zoom</button>
          <div class="speed"><span>Speed</span>${[0.25, 0.5, 1, 1.5, 2].map((r) => `<button class="btn tiny ${r === 1 ? "on" : ""}" data-rate="${r}">${r}×</button>`).join("")}</div>
        </div>
        <div class="timeline card">
          <canvas id="tl" height="132"></canvas>
          <div class="legend" id="legend"></div>
        </div>
        <div class="shots card" id="shots"></div>
        <details class="card keys"><summary>⌨️ Keyboard shortcuts</summary>
          <div class="kgrid">
            <span><kbd>J</kbd>/<kbd>K</kbd> prev / next rally</span><span><kbd>←</kbd>/<kbd>→</kbd> prev / next shot</span>
            <span><kbd>Space</kbd> play / pause</span><span><kbd>P</kbd> play rally</span>
            <span><kbd>Y</kbd> rally correct</span><span><kbd>N</kbd> not a rally</span>
            <span><kbd>A</kbd>/<kbd>B</kbd> point to team</span><span><kbd>S</kbd> add shot at playhead</span>
            <span><kbd>L</kbd> loop</span><span><kbd>Z</kbd> zoom timeline</span>
          </div></details>
      </div>

      <aside class="ws-right">
        <div class="scoreboard card" id="score"></div>
        <div class="review card" id="review"></div>
        <div class="rallies card">
          <div class="sec-h"><h3>🏓 Rallies</h3><div class="seg small" id="rfilter">
            <button data-f="all" class="on">All</button><button data-f="unchecked">To check</button><button data-f="ok">✓</button><button data-f="rejected">✗</button></div></div>
          <div class="rlist" id="rlist"></div>
        </div>
        <div class="mix card" id="mix"></div>
      </aside>
    </section>
  </main>`;

  const vid = $<HTMLVideoElement>("#vid");
  const cvs = $<HTMLCanvasElement>("#tl");
  let rfilter = "all";

  /* ---------- derived */
  const shotsOf = (rid: number) => S.shots.filter((s) => s.rally === rid).sort((a, b) => a.t - b.t);
  const rally = (rid: number | null) => S.rallies.find((r) => r.id === rid) ?? null;
  const point = (rid: number) => S.points.find((p) => p.rally === rid);
  const live = () => S.rallies.filter((r) => r.status !== "rejected");
  const ordered = () => [...S.rallies].sort((a, b) => a.start - b.start);
  const rallyAt = (t: number) => S.rallies.find((r) => t >= r.start - 0.8 && t <= r.end + 0.4) ?? null;

  const renumber = (rid: number) => {
    const list = shotsOf(rid);
    list.forEach((s, i) => { s.index = i + 1; });
    const r = rally(rid);
    if (r && list.length) { r.n_shots = list.length; r.start = list[0].t; r.end = Math.max(r.end, list[list.length - 1].t + 0.3); }
  };

  /* ---------- autosave */
  let saveT = 0;
  const save = () => {
    const el = $("#saved"); el.textContent = "✏️ Saving…"; el.classList.add("dirty");
    clearTimeout(saveT);
    saveT = window.setTimeout(async () => {
      await api.saveReview(job.id, { rallies: S.rallies, shots: S.shots, points: S.points, firstServer: S.firstServer });
      el.textContent = DEMO ? "💾 Saved in browser" : "💾 Saved"; el.classList.remove("dirty");
    }, 500);
  };

  /* ---------- renderers */
  function renderStats() {
    const L = live(); const ids = new Set(L.map((r) => r.id));
    const sh = S.shots.filter((s) => ids.has(s.rally));
    const lens = L.map((r) => shotsOf(r.id).length);
    const play = L.reduce((a, r) => a + (r.end - r.start), 0);
    const longest = L.reduce<Rally | null>((m, r) => (!m || shotsOf(r.id).length > shotsOf(m.id).length ? r : m), null);
    const cards: [string, string, string, string?][] = [
      ["🏓", String(L.length), "Rallies"],
      ["🎾", String(sh.length), "Shots tagged"],
      ["🚩", String(L.length), "Points / side-outs"],
      ["📊", lens.length ? (sh.length / L.length).toFixed(1) : "0", "Avg shots / rally"],
      ["🔥", longest ? String(shotsOf(longest.id).length) : "0", "Longest rally (shots)", longest ? `R${longest.id}` : ""],
      ["⏱", `${Math.round((play / res.video.duration) * 100)}%`, "Ball-in-play time", fmtDur(play)],
    ];
    $("#stats").innerHTML = cards.map(([e, v, l, x], i) =>
      `<div class="stat card" style="--d:${i * 40}ms" ${x?.startsWith("R") ? `data-go="${x.slice(1)}"` : ""}><span class="se">${e}</span><b>${v}</b><small>${l}${x ? ` · ${x}` : ""}</small></div>`).join("");
  }

  function renderScore() {
    const steps = replay(S.rallies, S.points, job.scoring, S.firstServer);
    const last = steps[steps.length - 1];
    const sc = last?.after.score ?? { A: 0, B: 0 };
    const serving = last?.after.serving ?? S.firstServer;
    const call = last?.call ?? (job.scoring === "rally" ? "0-0" : "0-0-2");
    const unscored = live().filter((r) => !point(r.id)?.winner).length;
    const upto = S.cur != null ? steps.filter((s) => (rally(s.rally)?.start ?? 0) <= (rally(S.cur)?.start ?? 0)).pop() : null;
    $("#score").innerHTML = `
      <div class="sec-h"><h3>🏆 Scoreboard</h3><span class="call" title="Score call (server's score first)">${call}</span></div>
      <div class="sb">
        <div class="team a ${serving === "A" ? "srv" : ""}"><small>🟢 ${esc(T.A)}</small><b>${sc.A}</b>${serving === "A" ? "<i>🎾 serving</i>" : ""}</div>
        <div class="vs">vs</div>
        <div class="team b ${serving === "B" ? "srv" : ""}"><small>🔵 ${esc(T.B)}</small><b>${sc.B}</b>${serving === "B" ? "<i>🎾 serving</i>" : ""}</div>
      </div>
      ${upto ? `<p class="muted small">After rally ${upto.rally}: <b>${upto.call}</b> ${upto.scored ? "· point scored" : "· side-out / 2nd server"}</p>` : ""}
      <div class="fs"><span>First serve:</span>
        <button class="btn tiny ${S.firstServer === "A" ? "on" : ""}" data-fs="A">${esc(T.A)}</button>
        <button class="btn tiny ${S.firstServer === "B" ? "on" : ""}" data-fs="B">${esc(T.B)}</button></div>
      ${unscored ? `<p class="hint">👉 ${unscored} rall${unscored > 1 ? "ies" : "y"} without a winner. Pick 🟢/🔵 on each rally card to build the score.</p>` : `<p class="hint ok">🎉 All rallies scored!</p>`}`;
  }

  function renderReview() {
    const n = S.rallies.length, ok = S.rallies.filter((r) => r.status === "ok").length, rej = S.rallies.filter((r) => r.status === "rejected").length;
    const done = ok + rej;
    $("#review").innerHTML = `
      <div class="sec-h"><h3>🕵️ Human check</h3><span class="muted">${done}/${n} reviewed</span></div>
      <div class="pbar tri"><div class="okb" style="width:${(ok / Math.max(1, n)) * 100}%"></div><div class="rejb" style="width:${(rej / Math.max(1, n)) * 100}%"></div></div>
      <div class="legend2"><span><i class="dot ok"></i>${ok} correct</span><span><i class="dot rej"></i>${rej} not a rally</span><span><i class="dot un"></i>${n - done} to check</span></div>
      ${n - done ? `<button class="btn primary wide" data-a="nextUnchecked">🔎 Review next unchecked rally</button>` : `<p class="hint ok">✅ Review complete — export when ready.</p>`}`;
  }

  function renderRallies() {
    const list = ordered().filter((r) => rfilter === "all" || r.status === rfilter);
    $("#rlist").innerHTML = list.length ? list.map((r) => {
      const p = point(r.id); const n = shotsOf(r.id).length;
      return `
      <div class="rcard ${r.status} ${S.cur === r.id ? "cur" : ""}" data-r="${r.id}">
        <div class="rthumb"><img src="${api.thumbUrl(job.id, r.id)}" loading="lazy"/><span>R${r.id}</span></div>
        <div class="rbody">
          <div class="rtop"><b>Rally ${r.id}</b><span class="muted">${fmt(r.start)} → ${fmt(r.end)}</span></div>
          <div class="rmeta"><span>🎾 ${n} shots</span><span>⏱ ${(r.end - r.start).toFixed(1)}s</span>${p ? `<span>🚩 ${fmt(p.t)}</span>` : ""}</div>
          <div class="rbtns">
            <button class="chipbtn ${r.status === "ok" ? "on ok" : ""}" data-st="ok" title="Correct rally (Y)">✓</button>
            <button class="chipbtn ${r.status === "rejected" ? "on rej" : ""}" data-st="rejected" title="Not a rally (N)">✗</button>
            <span class="sep"></span>
            <button class="chipbtn team a ${p?.winner === "A" ? "on" : ""}" data-win="A" title="Point to ${esc(T.A)} (A)">🟢 ${esc(T.A)}</button>
            <button class="chipbtn team b ${p?.winner === "B" ? "on" : ""}" data-win="B" title="Point to ${esc(T.B)} (B)">🔵 ${esc(T.B)}</button>
          </div>
        </div>
      </div>`;
    }).join("") : `<div class="muted pad">Nothing here 🎉</div>`;
  }

  function renderShots() {
    const r = rally(S.cur);
    const el = $("#shots");
    if (!r) { el.innerHTML = `<div class="sec-h"><h3>🎾 Shots</h3></div><p class="muted">Pick a rally on the right (or press <kbd>K</kbd>) to see and fix its shots.</p>`; return; }
    const list = shotsOf(r.id);
    el.innerHTML = `
      <div class="sec-h"><h3>🎾 Rally ${r.id} · ${list.length} shots</h3>
        <div><button class="btn tiny" data-a="addShot" title="Add a shot at the playhead (S)">➕ Add shot at ${fmt(vid.currentTime)}</button></div></div>
      <div class="shot-strip">${list.map((s) => `
        <div class="shot ${S.curShot === s.id ? "cur" : ""} ${S.filter.size && !S.filter.has(s.label) ? "dim" : ""}" data-s="${s.id}" style="--c:${SHOT_COLORS[s.label] ?? "#ccc"}">
          <div class="sn">#${s.index}${s.index === list.length ? " 🏁" : ""}</div>
          <div class="st">${fmt(s.t)}</div>
          <select data-lab="${s.id}">${SHOT_TYPES.map((t) => `<option ${t === s.label ? "selected" : ""} value="${t}">${SHOT_EMOJI[t]} ${t}</option>`).join("")}</select>
          <div class="conf" title="Detector confidence"><div style="width:${s.confidence * 100}%"></div></div>
          <button class="x" data-delshot="${s.id}" title="Remove false hit">✕</button>
        </div>`).join("")}</div>`;
  }

  function renderMix() {
    const ids = new Set(live().map((r) => r.id));
    const cnt: Record<string, number> = {};
    S.shots.filter((s) => ids.has(s.rally)).forEach((s) => { cnt[s.label] = (cnt[s.label] ?? 0) + 1; });
    const tot = Object.values(cnt).reduce((a, b) => a + b, 0) || 1;
    const rows = SHOT_TYPES.filter((t) => cnt[t]).sort((a, b) => cnt[b] - cnt[a]);
    $("#mix").innerHTML = `<div class="sec-h"><h3>🧁 Shot mix</h3><span class="muted">tap to highlight</span></div>` + rows.map((t) => `
      <button class="mixrow ${S.filter.has(t) ? "on" : ""}" data-mf="${t}">
        <span>${SHOT_EMOJI[t]} ${t}</span><div class="bar"><div style="width:${(cnt[t] / tot) * 100}%;background:${SHOT_COLORS[t]}"></div></div><b>${cnt[t]}</b></button>`).join("");
    $("#legend").innerHTML = `<span><i class="sw rally"></i>rally</span><span><i class="sw ok"></i>checked</span><span><i class="sw rej"></i>rejected</span><span>🚩 point</span><span><i class="sw act"></i>hit activity</span>` +
      rows.slice(0, 6).map((t) => `<span><i class="tick" style="background:${SHOT_COLORS[t]}"></i>${t}</span>`).join("");
  }

  function hud() {
    const t = vid.currentTime; const r = rallyAt(t);
    const near = S.shots.filter((s) => Math.abs(s.t - t) < 0.35).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    const pt = S.points.find((p) => t >= p.t && t < p.t + 1.2 && rally(p.rally)?.status !== "rejected");
    const html = `
      ${r ? `<span class="h-r ${r.status}">🏓 Rally ${r.id}${r.status === "rejected" ? " (rejected)" : ""}</span>` : `<span class="h-r idle">💤 between points</span>`}
      ${near ? `<span class="h-s pop" style="--c:${SHOT_COLORS[near.label]}">${SHOT_EMOJI[near.label]} #${near.index} ${near.label}</span>` : ""}
      ${pt ? `<span class="h-p pop">🚩 Point${pt.winner ? ` → ${esc(T[pt.winner])}` : ""}</span>` : ""}`;
    if (html !== hudHtml) { hudHtml = html; $("#hud").innerHTML = html + `<span class="h-t" id="ht"></span>`; }
    $("#ht").textContent = fmt(t);
  }
  let hudHtml = "";

  /* ---------- timeline canvas */
  let view: [number, number] = [0, res.video.duration];
  function setView() {
    const r = rally(S.cur);
    view = S.zoom && r ? [Math.max(0, r.start - 3), Math.min(res.video.duration, r.end + 3)] : [0, res.video.duration];
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = 132;
    if (cvs.width !== w * dpr) { cvs.width = w * dpr; cvs.height = h * dpr; }
    const g = cvs.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const [v0, v1] = view; const X = (t: number) => ((t - v0) / (v1 - v0)) * w;
    // background lanes
    g.fillStyle = "#f3f6ec"; g.beginPath(); g.roundRect(0, 0, w, h, 12); g.fill();
    // activity curve
    const { t: ct, activity } = res.curves; const amax = Math.max(2.5, ...activity);
    g.beginPath(); g.moveTo(0, 96);
    ct.forEach((t, i) => { if (t >= v0 - 1 && t <= v1 + 1) g.lineTo(X(t), 96 - (activity[i] / amax) * 40); });
    g.lineTo(w, 96); g.closePath(); g.fillStyle = "rgba(27,153,139,.18)"; g.fill();
    // rallies
    for (const r of S.rallies) {
      const x0 = X(r.start), x1 = X(r.end); if (x1 < 0 || x0 > w) continue;
      g.fillStyle = r.status === "ok" ? "#22c55e" : r.status === "rejected" ? "#cbd5e1" : "#c7e33a";
      g.beginPath(); g.roundRect(x0, 22, Math.max(3, x1 - x0), 22, 7); g.fill();
      if (S.cur === r.id) { g.strokeStyle = "#13315c"; g.lineWidth = 2.5; g.stroke(); }
      if (x1 - x0 > 26) { g.fillStyle = r.status === "rejected" ? "#64748b" : "#13315c"; g.font = "600 11px ui-rounded, system-ui"; g.fillText(`R${r.id}`, x0 + 6, 37); }
      const p = point(r.id);
      if (p && r.status !== "rejected") { g.font = "14px system-ui"; g.fillText("🚩", X(p.t) - 4, 18); }
    }
    // shots
    for (const s of S.shots) {
      const x = X(s.t); if (x < -2 || x > w + 2) continue;
      const rej = rally(s.rally)?.status === "rejected";
      const dim = S.filter.size > 0 && !S.filter.has(s.label);
      g.fillStyle = rej || dim ? "#d6dbe1" : SHOT_COLORS[s.label] ?? "#999";
      const tall = S.curShot === s.id ? 30 : 20;
      g.beginPath(); g.roundRect(x - 1.5, 100 - tall / 2 + 10, 3, tall, 2); g.fill();
    }
    // time axis
    g.fillStyle = "#7b8794"; g.font = "10px ui-rounded, system-ui";
    const span = v1 - v0, stepT = span > 120 ? 30 : span > 40 ? 10 : span > 15 ? 5 : 1;
    for (let t = Math.ceil(v0 / stepT) * stepT; t <= v1; t += stepT) g.fillText(fmt(t).replace(/\.\d$/, ""), X(t) + 2, 128);
    // playhead
    const px = X(vid.currentTime); g.fillStyle = "#ff5a8a"; g.fillRect(px - 1, 4, 2, h - 18);
    g.beginPath(); g.arc(px, 6, 5, 0, Math.PI * 2); g.fill();
  }
  cvs.addEventListener("click", (e) => {
    const rect = cvs.getBoundingClientRect(); const t = view[0] + ((e.clientX - rect.left) / rect.width) * (view[1] - view[0]);
    const r = rallyAt(t); if (r && r.id !== S.cur) select(r.id, false);
    vid.currentTime = t; draw();
  });

  /* ---------- actions */
  function refresh() { renderStats(); renderScore(); renderReview(); renderRallies(); renderShots(); renderMix(); setView(); draw(); hud(); }

  function select(rid: number, seek = true) {
    S.cur = rid; S.curShot = null;
    if (seek) { const r = rally(rid)!; vid.currentTime = Math.max(0, r.start - 1); }
    refresh();
    document.querySelector(`.rcard[data-r="${rid}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function stepRally(d: 1 | -1) {
    const L = ordered(); const t = vid.currentTime;
    const i = S.cur != null ? L.findIndex((r) => r.id === S.cur) : -1;
    const n = i >= 0 ? L[i + d] : d > 0 ? L.find((r) => r.start > t) : [...L].reverse().find((r) => r.end < t);
    if (n) select(n.id);
  }
  function stepShot(d: 1 | -1) {
    const all = [...S.shots].filter((s) => rally(s.rally)?.status !== "rejected").sort((a, b) => a.t - b.t);
    const t = vid.currentTime;
    const s = d > 0 ? all.find((x) => x.t > t + 0.05) : [...all].reverse().find((x) => x.t < t - 0.25);
    if (!s) return;
    if (s.rally !== S.cur) { S.cur = s.rally; }
    S.curShot = s.id; vid.currentTime = Math.max(0, s.t - 0.2); refresh();
  }
  function setStatus(rid: number, st: RallyStatus) {
    const r = rally(rid)!; r.status = r.status === st ? "unchecked" : st; save(); refresh();
  }
  function setWinner(rid: number, w: Team) {
    let p = point(rid);
    const r = rally(rid)!;
    if (!p) { p = { id: `p${rid}`, rally: rid, t: r.end, label: `Point / side-out #${rid}`, winner: null, note: "" }; S.points.push(p); }
    p.winner = p.winner === w ? null : w;
    if (p.winner && r.status === "unchecked") r.status = "ok";
    save(); refresh();
  }
  function addShot() {
    const t = +vid.currentTime.toFixed(2);
    let r = rallyAt(t);
    if (!r) { // new manual rally
      const id = Math.max(0, ...S.rallies.map((x) => x.id)) + 1;
      r = { id, start: t, end: t + 1, n_shots: 0, point_t: t + 1, rally_type: "manual", status: "ok" };
      S.rallies.push(r);
    }
    const id = `m${Date.now().toString(36)}`;
    S.shots.push({ id, rally: r.id, index: 0, t, label: "other", strength_db: 0, confidence: 1, manual: true });
    renumber(r.id); S.cur = r.id; S.curShot = id; save(); refresh();
  }

  app.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const a = el.closest<HTMLElement>("[data-a]")?.dataset.a;
    const card = el.closest<HTMLElement>(".rcard");
    if (el.closest("[data-st]") && card) return setStatus(+card.dataset.r!, el.closest<HTMLElement>("[data-st]")!.dataset.st as RallyStatus);
    if (el.closest("[data-win]") && card) return setWinner(+card.dataset.r!, el.closest<HTMLElement>("[data-win]")!.dataset.win as Team);
    if (card && !el.closest("button")) return select(+card.dataset.r!);
    const go = el.closest<HTMLElement>("[data-go]"); if (go) return select(+go.dataset.go!);
    const fs = el.closest<HTMLElement>("[data-fs]"); if (fs) { S.firstServer = fs.dataset.fs as Team; save(); return refresh(); }
    const mf = el.closest<HTMLElement>("[data-mf]");
    if (mf) { const t = mf.dataset.mf!; S.filter.has(t) ? S.filter.delete(t) : S.filter.add(t); return refresh(); }
    const rf = el.closest<HTMLElement>("[data-f]");
    if (rf) { rfilter = rf.dataset.f!; rf.parentElement!.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === rf)); return renderRallies(); }
    const rate = el.closest<HTMLElement>("[data-rate]");
    if (rate) { vid.playbackRate = +rate.dataset.rate!; app.querySelectorAll("[data-rate]").forEach((b) => b.classList.toggle("on", b === rate)); return; }
    const ds = el.closest<HTMLElement>("[data-delshot]");
    if (ds) { const s = S.shots.find((x) => x.id === ds.dataset.delshot)!; S.shots = S.shots.filter((x) => x !== s); renumber(s.rally); save(); return refresh(); }
    const sh = el.closest<HTMLElement>(".shot[data-s]");
    if (sh && !el.closest("select")) { const s = S.shots.find((x) => x.id === sh.dataset.s)!; S.curShot = s.id; vid.currentTime = Math.max(0, s.t - 0.2); return refresh(); }
    switch (a) {
      case "prevRally": return stepRally(-1);
      case "nextRally": return stepRally(1);
      case "prevShot": return stepShot(-1);
      case "nextShot": return stepShot(1);
      case "playRally": { if (S.cur == null) stepRally(1); const r = rally(S.cur); if (r) { vid.currentTime = Math.max(0, r.start - 1); vid.play(); } return; }
      case "loop": S.loop = !S.loop; $("#loopBtn").classList.toggle("on", S.loop); return;
      case "zoom": S.zoom = !S.zoom; $("#zoomBtn").classList.toggle("on", S.zoom); setView(); return draw();
      case "addShot": return addShot();
      case "nextUnchecked": { const n = ordered().find((r) => r.status === "unchecked"); if (n) { select(n.id); vid.play(); } return; }
      case "exportCsv": return download("dinklab-demo.csv", toCsv(S, T), "text/csv");
      case "exportJson": return download("dinklab-demo.json",
        JSON.stringify({ ...res, rallies: S.rallies, shots: S.shots, points: S.points }, null, 1), "application/json");
      case "resetDemo":
        if (confirm("Reset the demo? Your checks, labels and point winners in this browser will be cleared.")) {
          clearTimeout(saveT); api.remove(job.id).then(() => route());
        }
        return;
    }
  }, on);
  app.addEventListener("change", (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.dataset.lab) { const s = S.shots.find((x) => x.id === el.dataset.lab)!; s.label = el.value; save(); renderMix(); draw(); renderShots(); }
    if (el.id === "re" && el.value) {
      if (confirm(`Re-run detection with "${PRESETS[el.value]}" sensitivity? Your review edits will be cleared.`)) api.reanalyze(job.id, el.value).then(() => route());
      el.value = "";
    }
  }, on);
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input,select,textarea")) return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      j: () => stepRally(-1), k: () => stepRally(1), arrowleft: () => stepShot(-1), arrowright: () => stepShot(1),
      " ": () => (vid.paused ? vid.play() : vid.pause()), p: () => $<HTMLButtonElement>('[data-a="playRally"]').click(),
      y: () => S.cur != null && setStatus(S.cur, "ok"), n: () => S.cur != null && setStatus(S.cur, "rejected"),
      a: () => S.cur != null && setWinner(S.cur, "A"), b: () => S.cur != null && setWinner(S.cur, "B"),
      s: addShot, l: () => $<HTMLButtonElement>("#loopBtn").click(), z: () => $<HTMLButtonElement>("#zoomBtn").click(),
    };
    if (map[k]) { e.preventDefault(); map[k](); }
  };
  window.addEventListener("keydown", onKey, on);

  let raf = 0;
  const frame = () => {
    const r = rally(S.cur);
    if (S.loop && r && !vid.paused && vid.currentTime > r.end + 0.6) vid.currentTime = Math.max(0, r.start - 1);
    draw(); hud(); raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  window.addEventListener("resize", () => draw(), on);
  cleanup = () => cancelAnimationFrame(raf);

  refresh();
}
