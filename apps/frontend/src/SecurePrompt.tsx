import type { PromptKind } from "./prompt-guard";
import { PROMPT_LIMITS, promptIssue, stripPromptNoise } from "./prompt-guard";

type Shared = {
  kind: PromptKind;
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  placeholder?: string;
};

export function SecurePrompt({ kind, value, onChange, id, className, disabled, required, rows, placeholder }: Shared) {
  const limit = PROMPT_LIMITS[kind];
  const issue = value ? promptIssue(value, kind) : null;
  return (
    <>
      <textarea
        id={id}
        className={className}
        rows={rows}
        required={required}
        disabled={disabled}
        maxLength={limit.max}
        placeholder={placeholder}
        value={value}
        aria-invalid={Boolean(issue)}
        onChange={(e) => onChange(stripPromptNoise(e.target.value))}
      />
      {issue ? <small className="prompt-guard-err" role="alert">{issue}</small> : null}
    </>
  );
}

export function SecureLine({
  kind,
  value,
  onChange,
  id,
  className,
  disabled,
  required,
  placeholder,
  type = "text",
}: Shared & { type?: string }) {
  const limit = PROMPT_LIMITS[kind];
  const issue = value ? promptIssue(value, kind) : null;
  return (
    <>
      <input
        id={id}
        type={type}
        className={className}
        required={required}
        disabled={disabled}
        maxLength={limit.max}
        placeholder={placeholder}
        value={value}
        aria-invalid={Boolean(issue)}
        onChange={(e) => onChange(stripPromptNoise(e.target.value))}
      />
      {issue ? <small className="prompt-guard-err" role="alert">{issue}</small> : null}
    </>
  );
}
