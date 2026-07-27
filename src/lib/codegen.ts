import type {
  ParamField, McpProject, McpTool, McpResource, McpPrompt,
  PromptArgument, EnvVar, HttpRequestConfig, DbQueryConfig,
} from "@/types/mcp";

function fieldToZod(field: ParamField): string {
  switch (field.type) {
    case "string":
      return `z.string().describe(${JSON.stringify(field.description || field.name)})`;
    case "number":
      return `z.number().describe(${JSON.stringify(field.description || field.name)})`;
    case "boolean":
      return `z.boolean().describe(${JSON.stringify(field.description || field.name)})`;
    case "array": {
      const itemZod =
        field.itemType === "number" ? "z.number()" :
        field.itemType === "boolean" ? "z.boolean()" :
        "z.string()";
      return `z.array(${itemZod}).describe(${JSON.stringify(field.description || field.name)})`;
    }
    case "object": {
      if (!field.children || field.children.length === 0) {
        return `z.object({}).describe(${JSON.stringify(field.description || field.name)})`;
      }
      const inner = field.children
        .map((c) => `    ${c.name}: ${fieldToZod(c)}${c.required ? "" : ".optional()"}`)
        .join(",\n");
      return `z.object({\n${inner}\n  }).describe(${JSON.stringify(field.description || field.name)})`;
    }
    default:
      return "z.string()";
  }
}

function generateToolSchema(fields: ParamField[]): string {
  if (fields.length === 0) return "{}";
  const lines = fields
    .map(
      (f) => `    ${f.name}: ${fieldToZod(f)}${f.required ? "" : ".optional()"}`
    )
    .join(",\n");
  return `{\n${lines}\n  }`;
}

export function generateHandlerBody(
  tool: McpTool,
  options?: { inProcess?: boolean }
): string {
  const inProcess = options?.inProcess === true;
  const handlerType = tool.handlerType || "code";

  if (handlerType === "code") {
    return tool.handlerCode;
  }

  if (handlerType === "http_request") {
    const config = tool.handlerConfig as HttpRequestConfig;
    const paramNames = tool.inputSchema.map((f) => f.name);

    let urlExpr = JSON.stringify(config.url);
    for (const p of paramNames) {
      urlExpr = urlExpr.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `\${${p}}`);
    }

    let headersCode = "{}";
    if (config.headers && config.headers.length > 0) {
      const entries = config.headers.map((h) => {
        let val = JSON.stringify(h.value);
        for (const p of paramNames) {
          val = val.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `\${${p}}`);
        }
        return `      ${JSON.stringify(h.key)}: \`${val.slice(1, -1)}\``;
      });
      headersCode = `{\n${entries.join(",\n")}\n    }`;
    }

    let fetchOptions = `{ method: ${JSON.stringify(config.method)}, headers: ${headersCode}`;

    if (config.method !== "GET" && config.bodyTemplate) {
      let bodyTpl = config.bodyTemplate;
      for (const p of paramNames) {
        bodyTpl = bodyTpl.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `\${${p}}`);
      }
      fetchOptions += `, body: \`${bodyTpl.replace(/`/g, "\\`")}\``;
    }
    fetchOptions += " }";

    const responseExpr = config.responseMapping
      ? `const data = await res.json();\n    const result = ${config.responseMapping};`
      : `const result = await res.text();`;

    return `const res = await fetch(\`${urlExpr.slice(1, -1)}\`, ${fetchOptions});
    ${responseExpr}
    return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };`;
  }

  if (handlerType === "db_query") {
    const config = tool.handlerConfig as DbQueryConfig;
    const paramNames = tool.inputSchema.map((f) => f.name);
    const vectorTypes = ["pinecone", "chromadb", "qdrant"];

    if (vectorTypes.includes(config.dbType)) {
      let queryTemplate = config.query;
      for (const p of paramNames) {
        queryTemplate = queryTemplate.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `\${${p}}`);
      }

      const topK = config.topK ?? 5;
      const collection = config.collection || "my_collection";

      if (config.dbType === "pinecone") {
        const ns = config.namespace ? `, namespace: ${JSON.stringify(config.namespace)}` : "";
        const pineconeLoad = inProcess
          ? `const { Pinecone } = globalThis.__PINECONE;`
          : `const { Pinecone } = await import("@pinecone-database/pinecone");`;
        return `${pineconeLoad}
    const pc = new Pinecone({ apiKey: process.env.${config.connectionEnvVar}! });
    const index = pc.index(${JSON.stringify(collection)});
    const queryText = \`${queryTemplate}\`;
    const results = await index.searchRecords({ query: { topK: ${topK}, inputs: { text: queryText }${ns} }, fields: ["category", "chunk_text"] });
    const hits = results.result.hits.map((h: { _id: string; _score: number; fields?: Record<string, unknown> }) => ({
      id: h._id,
      score: h._score,
      ...(h.fields || {}),
    }));
    return { content: [{ type: "text", text: JSON.stringify(hits, null, 2) }] };`;
      }

      if (config.dbType === "chromadb") {
        const chromaLoad = inProcess
          ? `const { ChromaClient } = globalThis.__CHROMADB;`
          : `const { ChromaClient } = await import("chromadb");`;
        return `${chromaLoad}
    const client = new ChromaClient({ path: process.env.${config.connectionEnvVar} || "http://localhost:8000" });
    const col = await client.getCollection({ name: ${JSON.stringify(collection)} });
    const queryText = \`${queryTemplate}\`;
    const results = await col.query({ queryTexts: [queryText], nResults: ${topK} });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };`;
      }

      if (config.dbType === "qdrant") {
        const apiKeyPart = config.namespace
          ? `, apiKey: process.env.${config.namespace}`
          : "";
        const qdrantLoad = inProcess
          ? `const { QdrantClient } = globalThis.__QDRANT;`
          : `const { QdrantClient } = await import("@qdrant/js-client-rest");`;
        return `${qdrantLoad}
    const client = new QdrantClient({ url: process.env.${config.connectionEnvVar} || "http://localhost:6333"${apiKeyPart} });
    const queryText = \`${queryTemplate}\`;
    const results = await client.query(${JSON.stringify(collection)}, { query: queryText, limit: ${topK} });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };`;
      }
    }

    const placeholders: string[] = [];
    let queryText = config.query;
    let paramIndex = 1;
    for (const p of paramNames) {
      if (queryText.includes(`{{${p}}}`)) {
        if (config.dbType === "postgresql") {
          queryText = queryText.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `$${paramIndex++}`);
        } else {
          queryText = queryText.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), `?`);
        }
        placeholders.push(p);
      }
    }

    if (config.dbType === "postgresql") {
      const pgLoad = inProcess
        ? `const { Pool } = globalThis.__PG;`
        : `const { Pool } = await import("pg");`;
      return `${pgLoad}
    const pool = new Pool({ connectionString: process.env.${config.connectionEnvVar} });
    const result = await pool.query(${JSON.stringify(queryText)}, [${placeholders.join(", ")}]);
    await pool.end();
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };`;
    }

    if (config.dbType === "mysql") {
      const mysqlLoad = inProcess
        ? `const mysql = globalThis.__MYSQL2;`
        : `const mysql = await import("mysql2/promise");`;
      return `${mysqlLoad}
    const conn = await mysql.createConnection(process.env.${config.connectionEnvVar}!);
    const [rows] = await conn.execute(${JSON.stringify(queryText)}, [${placeholders.join(", ")}]);
    await conn.end();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };`;
    }

    const sqliteLoad = inProcess
      ? `const Database = globalThis.__BETTER_SQLITE3;`
      : `const Database = (await import("better-sqlite3")).default;`;
    const sqlitePath = inProcess
      ? `process.env.${config.connectionEnvVar} || "./data.db"`
      : `process.env.${config.connectionEnvVar} || join(__projectRoot, "data.db")`;
    return `${sqliteLoad}
    const db = new Database(${sqlitePath});
    const rows = db.prepare(${JSON.stringify(queryText)}).all(${placeholders.join(", ")});
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };`;
  }

  return tool.handlerCode;
}

function generateToolRegistration(tool: McpTool): string {
  const schema = generateToolSchema(tool.inputSchema);
  const paramNames = tool.inputSchema.map((f) => f.name).join(", ");
  const destructure = paramNames ? `{ ${paramNames} }` : "_params";
  const body = generateHandlerBody(tool);

  return `server.tool(
  ${JSON.stringify(tool.name)},
  ${JSON.stringify(tool.description)},
  ${schema},
  async (${destructure}) => {
    ${body}
  }
);`;
}

function generateResourceRegistration(resource: McpResource): string {
  return `server.resource(
  ${JSON.stringify(resource.name)},
  ${JSON.stringify(resource.uri)},
  { description: ${JSON.stringify(resource.description)}, mimeType: ${JSON.stringify(resource.mimeType)} },
  async (uri) => {
    ${resource.handlerCode}
  }
);`;
}

function generatePromptRegistration(prompt: McpPrompt): string {
  const argsSchema =
    prompt.arguments.length === 0
      ? ""
      : prompt.arguments
          .map(
            (a: PromptArgument) =>
              `    ${a.name}: z.string().describe(${JSON.stringify(a.description || a.name)})${a.required ? "" : ".optional()"}`
          )
          .join(",\n");

  const argsObj = argsSchema ? `{\n${argsSchema}\n  }` : "{}";
  const destructuredArgs =
    prompt.arguments.length > 0
      ? `{ ${prompt.arguments.map((a: PromptArgument) => a.name).join(", ")} }`
      : "_args";

  let templateCode = prompt.template;
  prompt.arguments.forEach((a: PromptArgument) => {
    templateCode = templateCode.replace(
      new RegExp(`\\{\\{${a.name}\\}\\}`, "g"),
      `\${${a.name} || ""}`
    );
  });

  return `server.prompt(
  ${JSON.stringify(prompt.name)},
  ${JSON.stringify(prompt.description)},
  ${argsObj},
  (${destructuredArgs}) => {
    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: \`${templateCode}\` }
        }
      ]
    };
  }
);`;
}

function needsDbDeps(tools: McpTool[]): {
  pg: boolean; mysql: boolean; sqlite: boolean;
  pinecone: boolean; chromadb: boolean; qdrant: boolean;
} {
  const result = { pg: false, mysql: false, sqlite: false, pinecone: false, chromadb: false, qdrant: false };
  for (const tool of tools) {
    if (tool.handlerType === "db_query") {
      const config = tool.handlerConfig as DbQueryConfig;
      if (config.dbType === "postgresql") result.pg = true;
      if (config.dbType === "mysql") result.mysql = true;
      if (config.dbType === "sqlite") result.sqlite = true;
      if (config.dbType === "pinecone") result.pinecone = true;
      if (config.dbType === "chromadb") result.chromadb = true;
      if (config.dbType === "qdrant") result.qdrant = true;
    }
  }
  return result;
}

export type TransportMode = "http";

export function generateServerCode(
  project: McpProject,
  transport: TransportMode = "http"
): string {
  const tools = project.tools || [];
  const resources = project.resources || [];
  const prompts = project.prompts || [];

  const imports = [
    `import { fileURLToPath } from "url";`,
    `import { dirname, join } from "path";`,
    `import { config } from "dotenv";`,
    ``,
    `// Load .env from project root (works when MCP is started from any cwd)`,
    `const __dirname = dirname(fileURLToPath(import.meta.url));`,
    `config({ path: join(__dirname, "..", ".env") });`,
    `const __projectRoot = join(__dirname, "..");`,
    ``,
    `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`,
    `import express from "express";`,
    `import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";`,
  ];

  if (
    tools.length > 0 ||
    prompts.some((p) => p.arguments.length > 0)
  ) {
    imports.push(`import { z } from "zod";`);
  }

  const toolCode = tools.map(generateToolRegistration).join("\n\n");
  const resourceCode = resources.map(generateResourceRegistration).join("\n\n");
  const promptCode = prompts.map(generatePromptRegistration).join("\n\n");

  return `${imports.join("\n")}

function createServer(): McpServer {
  const server = new McpServer({
    name: ${JSON.stringify(project.name)},
    version: ${JSON.stringify(project.version)},
  });

  ${toolCode}

  ${resourceCode}

  ${promptCode}

  return server;
}

const app = express();
app.use(express.json());

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  const server = createServer();

  transport.onclose = () => {
    const sid = [...sessions.entries()].find(([, s]) => s.transport === transport)?.[0];
    if (sid) sessions.delete(sid);
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);

  const newSid = res.getHeader("mcp-session-id") as string | undefined;
  if (newSid && !sessions.has(newSid)) {
    sessions.set(newSid, { server, transport });
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "No active session" });
    return;
  }
  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    sessions.delete(sessionId);
  } else {
    res.status(400).json({ error: "No active session" });
  }
});

const PORT = parseInt(process.env.PORT || "3001");
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(\`${project.name} MCP server running on http://\${HOST}:\${PORT}/mcp\`);
});
`;
}

export function generatePackageJson(project: McpProject, transport: TransportMode = "http"): string {
  const tools = project.tools || [];
  const dbDeps = needsDbDeps(tools);

  const deps: Record<string, string> = {
    "dotenv": "^16.4.0",
    "@modelcontextprotocol/sdk": "^1.11.0",
    zod: "^3.23.0",
  };
  if (transport === "http") {
    deps.express = "^4.21.0";
  }
  if (dbDeps.pg) {
    deps.pg = "^8.13.0";
  }
  if (dbDeps.mysql) {
    deps.mysql2 = "^3.11.0";
  }
  if (dbDeps.sqlite) {
    deps["better-sqlite3"] = "^11.6.0";
  }
  if (dbDeps.pinecone) {
    deps["@pinecone-database/pinecone"] = "^4.0.0";
  }
  if (dbDeps.chromadb) {
    deps.chromadb = "^1.9.0";
  }
  if (dbDeps.qdrant) {
    deps["@qdrant/js-client-rest"] = "^1.12.0";
  }

  const devDeps: Record<string, string> = {
    "@types/node": "^22.0.0",
    typescript: "^5.6.0",
    "tsx": "^4.19.0",
  };
  if (transport === "http") {
    devDeps["@types/express"] = "^5.0.0";
  }
  if (dbDeps.pg) {
    devDeps["@types/pg"] = "^8.11.0";
  }
  if (dbDeps.sqlite) {
    devDeps["@types/better-sqlite3"] = "^7.6.0";
  }

  const pkg = {
    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    version: project.version,
    description: project.description,
    type: "module",
    main: "dist/index.js",
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "tsx src/index.ts",
    },
    dependencies: deps,
    devDependencies: devDeps,
  };

  return JSON.stringify(pkg, null, 2);
}

export function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
      },
      include: ["src/**/*"],
    },
    null,
    2
  );
}

export function generateDockerfile(project: McpProject): string {
  return `FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
`;
}

export function generateEnvExample(envVars: EnvVar[]): string {
  if (envVars.length === 0) return "# No environment variables configured\n";
  return envVars
    .map(
      (v) =>
        `${v.description ? `# ${v.description}\n` : ""}${v.key}=${v.value ? "your-value-here" : ""}`
    )
    .join("\n\n") + "\n";
}

export function generateReadme(project: McpProject): string {
  return `# ${project.name}

${project.description || "An MCP server built with DIY MCP Server Builder."}

## Setup

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build & Run

\`\`\`bash
npm run build
npm start
\`\`\`

## Docker

\`\`\`bash
docker build -t ${project.name} .
docker run -p 3001:3001 --env-file .env ${project.name}
\`\`\`

## Using with MCP Inspector

\`\`\`bash
npx @modelcontextprotocol/inspector node dist/index.js
\`\`\`

## Configuration

${
  (project.envVars || []).length > 0
    ? "Copy \\`.env.example\\` to \\`.env\\` and fill in the values:\n\n" +
      (project.envVars || []).map((v) => `- **${v.key}**: ${v.description || "No description"}`).join("\n")
    : "No environment variables required."
}

---
Built with [DIY MCP Server Builder](https://github.com)
`;
}
