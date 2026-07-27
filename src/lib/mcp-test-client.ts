export function safeParse(value: string, fallback: unknown = {}) {
  if (!value || value.trim() === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractJsonFromSse(text: string): unknown {
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const payload = line.slice(6).trim();
      if (payload) {
        try {
          return JSON.parse(payload);
        } catch {
          continue;
        }
      }
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function mcpRequest(
  port: number,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const url = `http://localhost:${port}/mcp`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const initRes = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "mcp-builder-test", version: "1.0.0" },
      },
      id: 1,
    }),
  });

  const initText = await initRes.text();
  const initData = extractJsonFromSse(initText) as Record<string, unknown> | null;

  if (!initData || initData.error) {
    const errMsg = initData ? JSON.stringify(initData.error) : "no response from server";
    throw new Error(`MCP init failed: ${errMsg}`);
  }

  const sessionId = initRes.headers.get("mcp-session-id");
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const notifRes = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  
  await notifRes.text();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 2,
    }),
  });

  const text = await res.text();
  if (!text || text.trim() === "") {
    throw new Error("Empty response from MCP server");
  }

  const data = extractJsonFromSse(text) as Record<string, unknown> | null;
  if (!data) {
    throw new Error(`Invalid response: ${text.substring(0, 200)}`);
  }
  if (data.error) {
    const err = data.error as Record<string, unknown>;
    throw new Error(String(err.message || JSON.stringify(err)));
  }
  return data.result;
}
