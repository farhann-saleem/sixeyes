import { Router } from "express";
import { MCP_TOKEN } from "./env.js";
import { MCP_TOOLS, callMcpTool } from "./mcp-tools.js";
import { currentUser } from "./google-auth.js";

const PROTOCOL = "2025-03-26";

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };

function ok(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function handleMcpRpc(body: unknown, ownerEmail = "anonymous"): Promise<{ status: number; payload: unknown }> {
  const msg = (body && typeof body === "object" ? body : {}) as Rpc;
  if (msg.jsonrpc !== "2.0" || !msg.method) {
    return { status: 200, payload: fail(msg.id, -32600, "Invalid Request") };
  }
  if (msg.method === "initialize") {
    return {
      status: 200,
      payload: ok(msg.id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "marketing-studio", version: "0.1.0" },
        instructions:
          "Marketing Studio MCP. Tools wrap the local product: documentaries, catalog looks, saved identities, library. Generate is async. Do not claim lip-sync. FaceFusion is internal.",
      }),
    };
  }
  if (msg.method === "notifications/initialized" || msg.method === "notifications/cancelled") {
    return { status: 202, payload: null };
  }
  if (msg.method === "ping") return { status: 200, payload: ok(msg.id, {}) };
  if (msg.method === "tools/list") return { status: 200, payload: ok(msg.id, { tools: MCP_TOOLS }) };
  if (msg.method === "tools/call") {
    const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as {
      name?: string;
      arguments?: unknown;
    };
    try {
      const result = await callMcpTool(String(params.name || ""), params.arguments, ownerEmail);
      return {
        status: 200,
        payload: ok(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 200,
        payload: ok(msg.id, { content: [{ type: "text", text: message }], isError: true }),
      };
    }
  }
  return { status: 200, payload: fail(msg.id, -32601, `Method not found: ${msg.method}`) };
}

function bearerOk(header: string | undefined): boolean {
  if (!MCP_TOKEN) return true;
  const got = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return got === MCP_TOKEN;
}

export const mcpRouter = Router();

mcpRouter.get("/", (_req, res) => {
  res.json({
    name: "marketing-studio",
    protocol: PROTOCOL,
    transport: "json-rpc POST",
    tools: MCP_TOOLS.map((t) => t.name),
    auth: MCP_TOKEN ? "Google session and bearer MCP_TOKEN" : "Google session",
  });
});

mcpRouter.post("/", async (req, res) => {
  if (!bearerOk(req.header("authorization"))) {
    res.status(401).json({ error: "MCP token required" });
    return;
  }
  const { status, payload } = await handleMcpRpc(req.body, currentUser(req)?.email || "anonymous");
  if (payload === null) {
    res.status(status).end();
    return;
  }
  res.status(status).json(payload);
});
