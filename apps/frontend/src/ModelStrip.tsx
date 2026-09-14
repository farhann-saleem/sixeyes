import { useState } from "react";
import type { CatalogModel } from "./model-catalog";

export function ModelStrip({
  label,
  models,
  value,
  onChange,
}: {
  label: string;
  models: CatalogModel[];
  value?: string;
  onChange?: (id: string) => void;
}) {
  const [picked, setPicked] = useState(value ?? models[0]?.id ?? "");
  const current = value ?? picked;

  return (
    <section className="model-strip" aria-label={label}>
      <div className="model-strip-head">
        <p className="kicker">{label}</p>
        <p className="model-strip-note">Pick an engine. Same studio quality on every plan.</p>
      </div>
      <div className="model-strip-grid" role="listbox" aria-label={label}>
        {models.map((m) => {
          const on = current === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={on}
              className={`model-chip${on ? " is-on" : ""}`}
              onClick={() => {
                setPicked(m.id);
                onChange?.(m.id);
              }}
            >
              {m.tag ? <span className="model-chip-tag">{m.tag}</span> : null}
              <strong>{m.name}</strong>
              <span>{m.vibe}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
