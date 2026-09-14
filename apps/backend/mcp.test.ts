import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMcpRpc } from "./src/mcp-rpc.js";
import { MCP_TOOLS, callMcpTool } from "./src/mcp-tools.js";

test("initialize and tools/list speak MCP JSON-RPC", async () => {
  const init = await handleMcpRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(init.status, 200);
  const ready = (init.payload as { result: { protocolVersion: string; serverInfo: { name: string } } }).result;
  assert.equal(ready.protocolVersion, "2025-03-26");
  assert.equal(ready.serverInfo.name, "marketing-studio");

  const listed = await handleMcpRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = (listed.payload as { result: { tools: { name: string }[] } }).result.tools;
  assert.deepEqual(
    tools.map((t) => t.name),
    MCP_TOOLS.map((t) => t.name),
  );
});

test("unknown tool is a tool error, not a crash", async () => {
  await assert.rejects(() => callMcpTool("invented", {}), /Unknown tool/);
  const rpc = await handleMcpRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "invented", arguments: {} },
  });
  const body = rpc.payload as { result: { isError?: boolean; content: { text: string }[] } };
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /Unknown tool/);
});

test("list tools return arrays", async () => {
  const templates = await callMcpTool("list_templates", { kind: "image" });
  assert.ok(Array.isArray(templates));
  const films = await callMcpTool("list_films", {});
  assert.ok(Array.isArray(films));
  const library = await callMcpTool("list_library", {});
  assert.ok(Array.isArray(library));
});
