import { useRef, useState } from "react";

function draftKey(resultId: string) {
  return `ms-avatar-name:${resultId}`;
}

export function SaveNamePanel({
  resultId,
  imageSrc,
  tag,
  alreadySaved,
  existingName,
  saving,
  onSave,
}: {
  resultId: string;
  imageSrc: string;
  tag: string;
  alreadySaved: boolean;
  existingName?: string;
  saving: boolean;
  onSave: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startValue = sessionStorage.getItem(draftKey(resultId)) ?? existingName ?? "";
  const [empty, setEmpty] = useState(!startValue.trim());

  return (
    <section className="compose-panel save-box">
      <p className="kicker">2. Name and save</p>
      <h2>This result</h2>
      <div className="stage-frame">
        <img src={imageSrc} alt={alreadySaved ? "Saved avatar" : "Portrait"} />
        <span className="stage-tag">{tag}</span>
      </div>
      <label htmlFor="save-name">Avatar name</label>
      <input
        id="save-name"
        ref={inputRef}
        type="text"
        name="avatar-display-name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="e.g. Farhann studio"
        defaultValue={startValue}
        disabled={saving}
        onInput={(e) => {
          const value = (e.target as HTMLInputElement).value;
          sessionStorage.setItem(draftKey(resultId), value);
          setEmpty(!value.trim());
        }}
      />
      <button
        type="button"
        className="btn primary"
        disabled={saving || empty}
        onClick={() => {
          const name = inputRef.current?.value.trim() ?? "";
          if (!name) return;
          onSave(name);
        }}
      >
        {saving ? "Saving…" : alreadySaved ? "Update name" : "Save avatar"}
      </button>
      <p className="muted">Saved avatars are what you select on image and video templates.</p>
    </section>
  );
}
