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

const j = async <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText);
  return r.json();
};

export const api = {
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
