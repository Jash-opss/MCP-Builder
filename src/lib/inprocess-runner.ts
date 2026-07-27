import { generateHandlerBody } from "./codegen";
import type { McpProject } from "@/types/mcp";

function ensureDbModulesLoaded(): void {
  if (typeof (globalThis as Record<string, unknown>).__PG !== "undefined") return;
  try {
    (globalThis as Record<string, unknown>).__PG = require("pg");
    (globalThis as Record<string, unknown>).__MYSQL2 = require("mysql2/promise");
    const sqlite = require("better-sqlite3");
    (globalThis as Record<string, unknown>).__BETTER_SQLITE3 = sqlite.default ?? sqlite;
    (globalThis as Record<string, unknown>).__PINECONE = require("@pinecone-database/pinecone");
    (globalThis as Record<string, unknown>).__CHROMADB = require("chromadb");
    (globalThis as Record<string, unknown>).__QDRANT = require("@qdrant/js-client-rest");
  } catch {
    // Some modules may fail (e.g. native deps); set what we have
  }
}

function applyEnvVars(envVars: { key: string; value: string }[] = []): () => void {
  const prev: Record<string, string | undefined> = {};
  for (const v of envVars) {
    prev[v.key] = process.env[v.key];
    process.env[v.key] = v.value;
  }
  return () => {
    for (const v of envVars) {
      if (prev[v.key] !== undefined) process.env[v.key] = prev[v.key];
      else delete process.env[v.key];
    }
  };
}

export async function runToolInProcess(
  project: McpProject,
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const tool = (project.tools || []).find((t) => t.name === toolName);
  if (!tool) throw new Error(`Tool not found: ${toolName}`);

  const paramNames = (tool.inputSchema || []).map((f) => f.name);
  const values = paramNames.map((p) => params[p]);
  ensureDbModulesLoaded();
  const body = generateHandlerBody(tool, { inProcess: true });

  const restoreEnv = applyEnvVars(
    (project.envVars || []).map((v) => ({ key: v.key, value: v.value }))
  );
  try {
    const fn = new Function(
      ...paramNames,
      `return (async () => { ${body} })();`
    );
    const result = await fn(...values);
    return result;
  } finally {
    restoreEnv();
  }
}

export async function runResourceInProcess(
  project: McpProject,
  uri: string
): Promise<unknown> {
  const resource = (project.resources || []).find((r) => r.uri === uri);
  if (!resource) throw new Error(`Resource not found: ${uri}`);

  const restoreEnv = applyEnvVars(
    (project.envVars || []).map((v) => ({ key: v.key, value: v.value }))
  );
  try {
    const fn = new Function(
      "uri",
      `return (async () => { ${resource.handlerCode} })();`
    );
    const result = await fn(uri);
    return result;
  } finally {
    restoreEnv();
  }
}

export function runPromptInProcess(
  project: McpProject,
  promptName: string,
  args: Record<string, unknown>
): { messages: Array<{ role: string; content: { type: string; text: string } }> } {
  const prompt = (project.prompts || []).find((p) => p.name === promptName);
  if (!prompt) throw new Error(`Prompt not found: ${promptName}`);

  let text = prompt.template;
  for (const a of prompt.arguments || []) {
    const val = args[a.name];
    text = text.replace(
      new RegExp(`\\{\\{\\s*${a.name}\\s*\\}\\}`, "g"),
      String(val ?? "")
    );
  }
  return {
    messages: [
      {
        role: "user",
        content: { type: "text", text },
      },
    ],
  };
}
