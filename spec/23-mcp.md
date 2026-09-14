# 23 — MCP (agent connector)

Owner GO 2026-09-14. Extra feature was Audio. MCP is now an explicit product desk — the Higgsfield-shaped **connector**, not Supercomputer and not 30 vendor models.

## What it is

An MCP JSON-RPC server on the **existing backend** (`POST http://localhost:3001/mcp`). Agents (Cursor, Claude Code) call **our** desks:

| Tool | Maps to |
| --- | --- |
| `list_templates` | Image / video / effect catalogs |
| `list_identities` | Saved avatars |
| `list_library` | Completed generate jobs |
| `list_films` / `get_film` / `create_documentary` | Spec 22 projects (`in_library` default true). `create_documentary` accepts optional `duration_sec` 30/45/60/90 |
| `generate_look` / `get_generation` | Existing async look generate (`avatar_id` + `template_id`) |

`generate_look` is async. Poll `get_generation`. FaceFusion stays internal. No lip-sync. No LTX from this pipe. Do not generate while CPU `throttled > 0`.

## Auth

Optional `MCP_TOKEN` in gitignored `.env`. If set, `Authorization: Bearer …`. If empty, open on this host (MVP, no login).

## UI

`/mcp` is the setup desk: endpoint, Cursor JSON, Claude command, tool list. Nav **MCPs** is live (not Soon).

## Out of scope

OAuth. Remote deploy. Invented models. Chat-that-runs-the-whole-campaign. Login.
