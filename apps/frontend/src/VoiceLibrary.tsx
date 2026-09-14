import { useEffect, useState } from "react";
import { CoverArt, togglePreview, usePlayingId, WaveBars } from "./audio-ui";
import { json } from "./studio";

export type CatalogVoice = {
  voice_id: string;
  name?: string;
  voice_name?: string;
  display_name?: string;
  language?: string;
  gender?: string;
  locale?: string;
  description?: string | null;
  category?: string | null;
  preview_url?: string | null;
  avatar_url?: string | null;
  accent?: string | null;
};

export function catalogVoiceName(v: CatalogVoice) {
  const raw = (v.name || v.voice_name || v.display_name || "").trim();
  if (!raw || /^(elevenlabs|minimax|edge|vbee|fishaudio|clone)_/i.test(raw)) return "Selected voice";
  return raw.split(" - ")[0].trim();
}

export { togglePreview, usePlayingId } from "./audio-ui";

type Shelf = {
  id: string;
  label: string;
  provider: string;
  total: number;
  voices: CatalogVoice[];
};

const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: "elevenlabs", label: "ElevenLabs" },
  { id: "minimax", label: "MiniMax" },
  { id: "edge", label: "Edge" },
  { id: "vbee", label: "Vbee" },
  { id: "fishaudio", label: "Fish" },
  { id: "clone", label: "Clones" },
];

function metaLine(v: CatalogVoice) {
  return [v.language, v.locale && v.locale !== v.language ? v.locale : null, v.gender, v.accent]
    .filter(Boolean)
    .join(" · ");
}

export function VoiceCard({
  voice,
  selected,
  onSelect,
  dense,
}: {
  voice: CatalogVoice;
  selected?: boolean;
  onSelect: (id: string, name: string) => void;
  dense?: boolean;
}) {
  const playing = usePlayingId() === voice.voice_id;
  const preview = voice.preview_url || "";
  const name = voice.name || voice.voice_id;
  return (
    <article className={`track-row${selected ? " on" : ""}${dense ? " dense" : ""}`}>
      <CoverArt
        src={voice.avatar_url}
        seed={name}
        playing={playing}
        label={name}
        onPlay={preview ? () => togglePreview(voice.voice_id, preview, { title: name, cover: voice.avatar_url }) : undefined}
      />
      <button
        type="button"
        className="track-copy"
        onClick={() => onSelect(voice.voice_id, catalogVoiceName(voice))}
      >
        <strong>{name === voice.voice_id ? catalogVoiceName(voice) : name}</strong>
        <span>{metaLine(voice) || "Voice"}</span>
        {playing ? <WaveBars active /> : null}
      </button>
    </article>
  );
}

export function VoicePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
}) {
  const [provider, setProvider] = useState("elevenlabs");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [premadeOnly, setPremadeOnly] = useState(true);
  const [rows, setRows] = useState<CatalogVoice[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = new URLSearchParams({
        provider,
        page: String(page),
        page_size: "24",
      });
      if (search.trim()) q.set("search", search.trim());
      if (provider === "elevenlabs" && premadeOnly && !search.trim()) q.set("category", "premade");
      json<{ data?: CatalogVoice[]; pagination?: { total?: number } }>(`/api/audio/voices?${q}`)
        .then((body) => {
          setRows(body.data || []);
          const n = body.data?.length || 0;
          const reported = body.pagination?.total || n;
          setTotal(provider === "elevenlabs" && premadeOnly && !search.trim() && n < 30 ? n : reported);
          setErr(null);
        })
        .catch((e: Error) => setErr(e.message));
    }, 200);
    return () => window.clearTimeout(t);
  }, [provider, search, page, premadeOnly]);

  useEffect(() => {
    const hit = rows.find((v) => v.voice_id === value);
    if (hit) onChange(value, catalogVoiceName(hit));
  }, [rows, value]);

  return (
    <div className="audio-bin compact">
      <div className="chip-row">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={provider === p.id ? "chip on" : "chip"}
            disabled={disabled}
            onClick={() => {
              setProvider(p.id);
              setPage(1);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        className="audio-search"
        placeholder="Search voices"
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {provider === "elevenlabs" ? (
        <label className="check quiet">
          <input
            type="checkbox"
            checked={premadeOnly}
            disabled={disabled}
            onChange={(e) => {
              setPremadeOnly(e.target.checked);
              setPage(1);
            }}
          />
          Official demos
        </label>
      ) : null}
      {err ? <p className="notice">{err}</p> : null}
      {value ? (
        <p className="picked">
          Using {(() => {
            const hit = rows.find((v) => v.voice_id === value);
            return hit ? catalogVoiceName(hit) : "selected voice";
          })()}
        </p>
      ) : null}
      <div className="track-list">
        {rows.map((v) => (
          <VoiceCard
            key={v.voice_id}
            voice={v}
            dense
            selected={value === v.voice_id}
            onSelect={disabled ? () => undefined : onChange}
          />
        ))}
      </div>
      <p className="bin-meta">
        {total} voices · preview is free
        {page > 1 || rows.length >= 24 ? (
          <>
            {" "}
            <button type="button" className="ghost-link" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button
              type="button"
              className="ghost-link"
              disabled={page * 24 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function VoiceLibraryBrowse({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [featured, setFeatured] = useState<CatalogVoice[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [provider, setProvider] = useState("elevenlabs");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [premadeOnly, setPremadeOnly] = useState(true);
  const [browse, setBrowse] = useState<CatalogVoice[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    json<{ shelves?: Shelf[] }>("/api/audio/voice-library")
      .then((body) => {
        setFeatured(body.shelves?.[0]?.voices || []);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = new URLSearchParams({
        provider,
        page: String(page),
        page_size: "24",
      });
      if (search.trim()) q.set("search", search.trim());
      if (provider === "elevenlabs" && premadeOnly && !search.trim()) q.set("category", "premade");
      json<{ data?: CatalogVoice[]; pagination?: { total?: number } }>(`/api/audio/voices?${q}`)
        .then((body) => {
          setBrowse(body.data || []);
          const n = body.data?.length || 0;
          const reported = body.pagination?.total || n;
          setTotal(provider === "elevenlabs" && premadeOnly && !search.trim() && n < 30 ? n : reported);
        })
        .catch((e: Error) => setErr(e.message));
    }, 200);
    return () => window.clearTimeout(t);
  }, [provider, search, page, premadeOnly]);

  return (
    <div className="audio-bin">
      <input
        type="search"
        className="audio-search"
        placeholder="Search voices"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="chip-row">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={provider === p.id ? "chip on" : "chip"}
            onClick={() => {
              setProvider(p.id);
              setPage(1);
            }}
          >
            {p.label}
          </button>
        ))}
        {provider === "elevenlabs" ? (
          <button
            type="button"
            className={premadeOnly ? "chip on" : "chip"}
            onClick={() => {
              setPremadeOnly((v) => !v);
              setPage(1);
            }}
          >
            Official
          </button>
        ) : null}
      </div>
      {err ? <p className="notice">{err}</p> : null}

      <div className="voice-bin-flow">
      {featured.length && provider === "elevenlabs" && premadeOnly && !search ? (
        <div className="voice-featured">
          <p className="shelf-label">For you</p>
          <div className="album-scroller">
            {featured.map((v) => (
              <VoiceAlbum key={v.voice_id} voice={v} selected={selected === v.voice_id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ) : null}

        <p className="shelf-label">{total} voices</p>
        <div className="track-list wide">
          {browse.map((v) => (
            <VoiceCard key={v.voice_id} voice={v} selected={selected === v.voice_id} onSelect={onSelect} />
          ))}
        </div>
        <p className="bin-meta">
          <button type="button" className="ghost-link" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button
            type="button"
            className="ghost-link"
            disabled={page * 24 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </p>
      </div>
    </div>
  );
}

function VoiceAlbum({
  voice,
  selected,
  onSelect,
}: {
  voice: CatalogVoice;
  selected: boolean;
  onSelect: (id: string, name: string) => void;
}) {
  const playing = usePlayingId() === voice.voice_id;
  const name = voice.name || voice.voice_id;
  const preview = voice.preview_url || "";
  return (
    <article className={selected ? "album-tile on" : "album-tile"}>
      <CoverArt
        src={voice.avatar_url}
        seed={name}
        playing={playing}
        label={name}
        size="lg"
        onPlay={preview ? () => togglePreview(voice.voice_id, preview, { title: name, cover: voice.avatar_url }) : undefined}
      />
      <button
        type="button"
        className="album-copy"
        onClick={() => onSelect(voice.voice_id, catalogVoiceName(voice))}
      >
        <strong>{name === voice.voice_id ? catalogVoiceName(voice) : name}</strong>
        <span>{voice.gender || voice.language || "Voice"}</span>
      </button>
    </article>
  );
}
