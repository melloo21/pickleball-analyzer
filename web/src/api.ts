export type Team = "A" | "B";
export type RallyStatus = "unchecked" | "ok" | "rejected";

export interface Shot {
  id: string; rally: number; index: number; t: number; label: string;
  strength_db: number; confidence: number; manual?: boolean;
}
export interface Rally {
  id: number; start: number; end: number; n_shots: number; point_t: number;
  rally_type: string; status?: RallyStatus;
}
export interface Point { id: string; rally: number; t: number; label: string; winner: Team | null; note: string }
export interface Summary {
  rallies: number; shots: number; points: number; avg_shots_per_rally: number;
  longest_rally_shots: number; longest_rally_s: number; play_time_s: number; duration_s: number;
}
export interface Result {
  video: { duration: number; width: number; height: number; fps: number; video_codec: string; audio_codec: string };
  rallies: Rally[]; shots: Shot[]; points: Point[]; summary: Summary;
  curves: { t: number[]; activity: number[]; gate: number[] };
}
export interface Job {
  id: string; name: string; state: "queued" | "running" | "done" | "error"; stage: string; progress: number;
  created: number; size_bytes: number; preset: string; teams: Record<Team, string>;
  scoring: "sideout" | "rally"; summary?: Summary; error?: string;
}
export interface Review { rallies?: Rally[]; shots?: Shot[]; points?: Point[]; firstServer?: Team; saved?: number }

/** Static build for GitHub Pages (`npm run build:demo`): no backend, one pre-analysed match,
 *  review edits kept in this browser's localStorage, exports built in the browser. */
export const DEMO = import.meta.env.VITE_DEMO === "1";
const D = `${import.meta.env.BASE_URL}demo/`;
const LS = "dinklab-demo-review-v1";

const j = async <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText);
  return r.json();
};
const noBackend = () => Promise.reject(new Error("This is a static demo with no backend. Run the app locally (./start.sh) to analyse your own videos."));

const demo = {
  jobs: async () => [await fetch(`${D}job.json`).then(j<Job>)],
  async job(id: string) {
    if (id !== "demo") throw new Error("not found");
    const [job, result, seed] = await Promise.all([
      fetch(`${D}job.json`).then(j<Job>), fetch(`${D}result.json`).then(j<Result>),
      fetch(`${D}review.json`).then(j<Review>).catch(() => ({} as Review)),
    ]);
    let review = seed;
    try { review = JSON.parse(localStorage.getItem(LS) ?? "null") ?? seed; } catch { /* corrupt: use seed */ }
    return { job, result, review };
  },
  async saveReview(_id: string, rv: Review) {
    const saved = Date.now() / 1000;
    try { localStorage.setItem(LS, JSON.stringify({ ...rv, saved })); } catch { /* private mode: keep in memory only */ }
    return { ok: true, saved };
  },
  reanalyze: (_id: string, _preset: string) => noBackend(),
  /** In the demo "delete" means "reset my edits". */
  async remove(_id: string) { localStorage.removeItem(LS); return { ok: true }; },
  videoUrl: (_id: string) => `${D}video.mp4`,
  thumbUrl: (_id: string, rid: number) => `${D}thumbs/r${rid}.jpg`,
  upload: (_f: File, _x: Record<string, string>, _p: (f: number) => void): Promise<{ id: string }> => noBackend(),
};

const server = {
  jobs: () => fetch("/api/jobs").then(j<Job[]>),
  job: (id: string) => fetch(`/api/jobs/${id}`).then(j<{ job: Job; result: Result | null; review: Review }>),
  saveReview: (id: string, rv: Review) =>
    fetch(`/api/jobs/${id}/review`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rv) }).then(j),
  reanalyze: (id: string, preset: string) =>
    fetch(`/api/jobs/${id}/reanalyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset }) }).then(j),
  remove: (id: string) => fetch(`/api/jobs/${id}`, { method: "DELETE" }).then(j),
  videoUrl: (id: string) => `/api/jobs/${id}/video`,
  thumbUrl: (id: string, rid: number) => `/api/jobs/${id}/thumb/${rid}.jpg`,

  /** Upload with real progress events (fetch has no upload progress). */
  upload(file: File, fields: Record<string, string>, onProgress: (f: number) => void): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(JSON.parse(xhr.responseText || "{}").detail ?? `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(fd);
    });
  },
};

export const api = DEMO ? demo : server;

/* ------------------------------------------------------------------ browser-side export (demo) */
/** Same columns and rules as app/analysis.py `to_csv`: rejected rallies are left out. */
export function toCsv(res: { rallies: Rally[]; shots: Shot[]; points: Point[] }, teams: Record<Team, string>): string {
  const hms = (t: number) => { const m = Math.floor(t / 60); return `${String(m).padStart(2, "0")}:${(t - m * 60).toFixed(2).padStart(5, "0")}`; };
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const lines = ["type,id,rally,shot_index,timestamp_s,timestamp,label,review_status,winner,strength_db,confidence"];
  for (const r of [...res.rallies].sort((a, b) => a.start - b.start)) {
    const st = r.status ?? "unchecked";
    if (st === "rejected") continue;
    const shots = res.shots.filter((s) => s.rally === r.id).sort((a, b) => a.t - b.t);
    lines.push(`rally_start,R${r.id},${r.id},,${r.start},${hms(r.start)},${q(`rally (${shots.length} shots)`)},${st},,,`);
    for (const s of shots)
      lines.push(`shot,${s.id},${s.rally},${s.index},${s.t},${hms(s.t)},${q(s.label.replace(" (rally end)", ""))},${st},,${s.strength_db},${s.confidence}`);
    for (const p of res.points.filter((p) => p.rally === r.id))
      lines.push(`point,${p.id},${p.rally},,${p.t},${hms(p.t)},${q(p.label)},${st},${q(p.winner ? teams[p.winner] : "")},,`);
  }
  return lines.join("\n") + "\n";
}

export function download(name: string, body: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
