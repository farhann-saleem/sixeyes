import { useEffect, useRef } from "react";
import {
  clipEnd,
  collision,
  footprint,
  formatTc,
  projectDuration,
  snapTime,
  type ClipKind,
  type ClipSource,
  type StudioClip,
  type StudioProject,
  type TrackKind,
} from "./model";

function laneKindOk(trackKind: TrackKind, clipKind: ClipKind) {
  if (clipKind === "audio") return trackKind === "audio";
  if (clipKind === "text") return trackKind === "text";
  return trackKind === "video";
}

type Drag =
  | { kind: "move"; id: string; startX: number; origStart: number; track: string }
  | { kind: "trim-l" | "trim-r"; id: string; startX: number; orig: StudioClip }
  | { kind: "playhead"; startX: number };

export function Timeline({
  project,
  selectedId,
  pps,
  onSelect,
  onChange,
  onPlayhead,
  onDropMedia,
}: {
  project: StudioProject;
  selectedId: string | null;
  pps: number;
  onSelect: (id: string | null) => void;
  onChange: (next: StudioProject, opts?: { persist?: boolean }) => void;
  onPlayhead: (sec: number) => void;
  onDropMedia: (media: { origin: ClipSource["type"]; id: string }, trackId: string, startSec: number) => void;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const duration = projectDuration(project);
  const width = Math.max(800, duration * pps + 80);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      const lanes = lanesRef.current;
      if (!drag || !lanes) return;
      const proj = projectRef.current;
      const px = ppsRef.current;
      const dx = e.clientX - drag.startX;
      const dt = dx / px;
      if (drag.kind === "playhead") {
        const rect = lanes.getBoundingClientRect();
        const sec = snapTime((e.clientX - rect.left + lanes.scrollLeft) / px, proj.playhead_sec, px);
        onPlayhead(Math.min(projectDuration(proj), sec));
        return;
      }
      if (drag.kind === "move") {
        const nextStart = snapTime(drag.origStart + dt, proj.playhead_sec, px);
        const current = proj.clips.find((c) => c.id === drag.id);
        let trackId = drag.track;
        const rect = lanes.getBoundingClientRect();
        const y = e.clientY - rect.top - 22;
        const index = Math.max(0, Math.min(proj.tracks.length - 1, Math.floor(y / 36)));
        const lane = proj.tracks[index];
        if (current && lane && laneKindOk(lane.kind, current.kind)) trackId = lane.id;
        const clips = proj.clips.map((c) =>
          c.id === drag.id ? { ...c, start_sec: nextStart, track_id: trackId } : c,
        );
        onChange({ ...proj, clips }, { persist: false });
        return;
      }
      const orig = drag.orig;
      if (drag.kind === "trim-l") {
        const nextStart = snapTime(orig.start_sec + dt, proj.playhead_sec, px);
        const delta = nextStart - orig.start_sec;
        const crop_start = orig.crop_start + delta;
        if (crop_start < 0 || orig.crop_end - crop_start < 0.2) return;
        onChange(
          {
            ...proj,
            clips: proj.clips.map((c) =>
              c.id === orig.id ? { ...c, start_sec: nextStart, crop_start } : c,
            ),
          },
          { persist: false },
        );
        return;
      }
      const nextEnd = snapTime(clipEnd(orig) + dt, proj.playhead_sec, px);
      const crop_end = orig.crop_start + (nextEnd - orig.start_sec);
      if (crop_end > orig.duration || crop_end - orig.crop_start < 0.2) return;
      onChange(
        {
          ...proj,
          clips: proj.clips.map((c) => (c.id === orig.id ? { ...c, crop_end } : c)),
        },
        { persist: false },
      );
    };
    const up = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.kind === "playhead") return;
      const proj = projectRef.current;
      const moved = proj.clips.find((c) => c.id === drag.id);
      if (!moved) return;
      if (collision(proj, moved)) {
        if (drag.kind === "move") {
          onChange(
            {
              ...proj,
              clips: proj.clips.map((c) =>
                c.id === drag.id ? { ...c, start_sec: drag.origStart, track_id: drag.track } : c,
              ),
            },
            { persist: true },
          );
          return;
        }
        onChange(
          { ...proj, clips: proj.clips.map((c) => (c.id === drag.id ? drag.orig : c)) },
          { persist: true },
        );
        return;
      }
      onChange(proj, { persist: true });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onChange, onPlayhead]);

  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.01; t += 1) ticks.push(t);

  return (
    <div className="nle-timeline">
      <div className="nle-track-labels">
        {project.tracks.map((tr) => (
          <div key={tr.id} className={`nle-track-label ${tr.kind}`}>
            {tr.name}
          </div>
        ))}
      </div>
      <div
        className="nle-lanes"
        ref={lanesRef}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".nle-clip")) return;
          const rect = lanesRef.current!.getBoundingClientRect();
          const sec = snapTime(
            (e.clientX - rect.left + lanesRef.current!.scrollLeft) / pps,
            project.playhead_sec,
            pps,
          );
          onPlayhead(sec);
          dragRef.current = { kind: "playhead", startX: e.clientX };
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/x-ms-media");
          if (!raw || !lanesRef.current) return;
          const media = JSON.parse(raw) as { origin: ClipSource["type"]; id: string };
          const rect = lanesRef.current.getBoundingClientRect();
          const y = e.clientY - rect.top - 22;
          const index = Math.max(0, Math.min(project.tracks.length - 1, Math.floor(y / 36)));
          const startSec = snapTime(
            (e.clientX - rect.left + lanesRef.current.scrollLeft) / pps,
            project.playhead_sec,
            pps,
          );
          onDropMedia(media, project.tracks[index].id, startSec);
        }}
      >
        <div className="nle-ruler" style={{ width }}>
          {ticks.map((t) => (
            <span key={t} style={{ left: t * pps }}>
              {formatTc(t).slice(0, 5)}
            </span>
          ))}
        </div>
        {project.tracks.map((tr) => (
          <div key={tr.id} className="nle-lane" style={{ width }}>
            {project.clips
              .filter((c) => c.track_id === tr.id)
              .map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`nle-clip ${c.kind}${selectedId === c.id ? " on" : ""}${collision(project, c) ? " bad" : ""}`}
                  style={{ left: c.start_sec * pps, width: Math.max(18, footprint(c) * pps) }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                    dragRef.current = {
                      kind: "move",
                      id: c.id,
                      startX: e.clientX,
                      origStart: c.start_sec,
                      track: c.track_id,
                    };
                  }}
                >
                  <span
                    className="handle l"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(c.id);
                      dragRef.current = { kind: "trim-l", id: c.id, startX: e.clientX, orig: { ...c } };
                    }}
                  />
                  {c.label}
                  <span
                    className="handle r"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(c.id);
                      dragRef.current = { kind: "trim-r", id: c.id, startX: e.clientX, orig: { ...c } };
                    }}
                  />
                </button>
              ))}
          </div>
        ))}
        <div className="nle-playhead" style={{ left: project.playhead_sec * pps }} />
        {project.clips.length === 0 ? (
          <div className="nle-empty-timeline">Empty timeline — drag a clip from the bin, or drop a file</div>
        ) : null}
      </div>
    </div>
  );
}
