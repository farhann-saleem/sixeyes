import { apiUrl, apiFetch } from "./api";
import { useEffect, useState } from "react";

const ENDPOINT = new URL(apiUrl("/api/mcp"), window.location.origin).href;

const CURSOR = `{
  "mcpServers": {
    "marketing-studio": {
      "url": "${ENDPOINT}"
    }
  }
}`;

const CLAUDE = `claude mcp add --transport http marketing-studio ${ENDPOINT}`;

const TOOLS = [
  ["list_templates", "Image, video, or effect looks"],
  ["list_identities", "Saved avatars"],
  ["list_library", "Finished stills and clips"],
  ["list_films", "Documentary projects"],
  ["create_documentary", "Topic → script. Optional duration_sec 30/45/60/90. Async."],
  ["get_film", "Phase and status for one film"],
  ["generate_look", "Look + saved identity. Async. Poll get_generation."],
  ["get_generation", "Poll a generate job"],
];

export function McpDesk() {
  const [copied, setCopied] = useState("");
  const [health, setHealth] = useState<string>("Checking the endpoint…");

  useEffect(() => {
    apiFetch(ENDPOINT)
      .then((r) => r.json())
      .then((body: { name?: string; tools?: string[] }) => {
        setHealth(
          body.name
            ? `Live · ${body.tools?.length ?? 0} tools on ${ENDPOINT}`
            : "Endpoint answered, but the body was unexpected.",
        );
      })
      .catch(() => setHealth("Endpoint unavailable. Sign in and check the backend."));
  }, []);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  return (
    <main className="studio mcp-page">
      <header className="page-head">
        <div>
          <p className="kicker">Model Context Protocol</p>
          <h1>Connect your AI assistant to Marketing Studio</h1>
          <p className="lede">
            Control your studio directly from Cursor or Claude. Let your AI assistant create documentaries,
            generate visual looks, list your saved avatars, and check render jobs. Hosted and provided directly
            by Marketing Studio at no extra charge, included free with your plan using your standard account credits.
          </p>
        </div>
      </header>

      <div className="mcp-desk">
        <section className="compose-panel">
          <p className="kicker">Hosted Endpoint</p>
          <h2>{ENDPOINT}</h2>
          <p className="lede">{health}</p>
          <p className="muted">
            Direct JSON-RPC connection hosted by Marketing Studio. Authenticates with your signed-in Google session.
            No separate server to maintain or host.
          </p>
          <div className="head-side">
            <button type="button" className="btn lime" onClick={() => void copy("url", ENDPOINT)}>
              {copied === "url" ? "Copied" : "Copy URL"}
            </button>
          </div>
        </section>

        <section className="mcp-card">
          <p className="kicker">Cursor</p>
          <h2>Add the server</h2>
          <p className="lede">Paste this into your MCP config. Then ask the agent to list films or start a documentary.</p>
          <pre className="mcp-dump">{CURSOR}</pre>
          <button type="button" className="btn ghost" onClick={() => void copy("cursor", CURSOR)}>
            {copied === "cursor" ? "Copied" : "Copy Cursor JSON"}
          </button>
        </section>

        <section className="mcp-card">
          <p className="kicker">Claude</p>
          <h2>One command</h2>
          <p className="lede">Works with Claude Code HTTP transport. Same tools.</p>
          <pre className="mcp-dump">{CLAUDE}</pre>
          <button type="button" className="btn ghost" onClick={() => void copy("claude", CLAUDE)}>
            {copied === "claude" ? "Copied" : "Copy command"}
          </button>
        </section>
      </div>

      <section className="mcp-tools">
        <p className="kicker">Tools</p>
        <h2>What an agent can call</h2>
        <ul>
          {TOOLS.map(([name, hint]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
