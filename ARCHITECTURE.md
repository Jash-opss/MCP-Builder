# Architecture

## Overview

DIY MCP Server Builder is a full-stack Next.js application that lets users visually design, test, and export Model Context Protocol (MCP) servers. Users configure tools, resources, and prompts through a web UI, test them with a built-in inspector, and download a complete project ready for Docker deployment.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌─────────┐  ┌──────────────────────────────────────────────┐  │
│  │Dashboard │  │              Builder Page                    │  │
│  │  (/)     │  │  /builder/[id]                               │  │
│  │         ─┼──▶  ┌─────────┬──────┬──────────┬────┬───────┐ │  │
│  │ Project  │  │  │Overview │Tools │Resources │... │Export │ │  │
│  │ Cards    │  │  └─────────┴──────┴──────────┴────┴───────┘ │  │
│  └─────────┘  └──────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (fetch)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js API Routes (Server)                   │
│                                                                 │
│  /api/projects ──────────────── CRUD projects                   │
│  /api/projects/[id] ────────── Get/Update/Delete project        │
│  /api/projects/[id]/tools ──── CRUD tools                       │
│  /api/projects/[id]/resources ─ CRUD resources                  │
│  /api/projects/[id]/prompts ── CRUD prompts                     │
│  /api/projects/[id]/env ────── CRUD env variables               │
│  /api/projects/[id]/test ───── Start/stop test server + proxy   │
│  /api/projects/[id]/export ─── Generate ZIP download            │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐         ┌────────────────────────┐
│   SQLite (Prisma) │         │   Code Generation      │
│                    │         │   Engine (codegen.ts)   │
│ Project            │         │                        │
│ Tool               │         │ Produces:              │
│ Resource           │         │  - src/index.ts        │
│ Prompt             │         │  - package.json        │
│ EnvVariable        │         │  - tsconfig.json       │
│                    │         │  - Dockerfile          │
└──────────────────┘         │  - .env.example        │
                              │  - README.md           │
                              └───────────┬────────────┘
                                          │
                              ┌───────────▼────────────┐
                              │   Test Runner           │
                              │   (test-runner.ts)      │
                              │                         │
                              │ - Writes generated code │
                              │   to /tmp               │
                              │ - npm install           │
                              │ - Spawns server with    │
                              │   HTTP transport        │
                              │ - Proxy JSON-RPC calls  │
                              │   from inspector UI     │
                              └─────────────────────────┘
```

## Tech Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Framework     | Next.js 16 (App Router, TypeScript)           |
| UI            | Tailwind CSS, Radix UI primitives, shadcn/ui  |
| Code Editor   | Monaco Editor (`@monaco-editor/react`)        |
| Database      | SQLite via Prisma ORM                         |
| ZIP Export    | `archiver`                                    |
| Generated SDK | `@modelcontextprotocol/sdk`                   |
| Icons         | Lucide React                                  |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                     Root layout (fonts, metadata)
│   ├── page.tsx                       Dashboard — list/create projects
│   ├── globals.css                    Tailwind + CSS custom properties
│   ├── builder/
│   │   └── [id]/
│   │       └── page.tsx               Builder page — tabbed project editor
│   └── api/
│       └── projects/
│           ├── route.ts               GET (list) / POST (create)
│           └── [id]/
│               ├── route.ts           GET / PATCH / DELETE single project
│               ├── tools/
│               │   ├── route.ts       GET / POST tools
│               │   └── [toolId]/
│               │       └── route.ts   PATCH / DELETE single tool
│               ├── resources/
│               │   ├── route.ts       GET / POST resources
│               │   └── [resourceId]/
│               │       └── route.ts   PATCH / DELETE single resource
│               ├── prompts/
│               │   ├── route.ts       GET / POST prompts
│               │   └── [promptId]/
│               │       └── route.ts   PATCH / DELETE single prompt
│               ├── env/
│               │   └── route.ts       GET / POST / PATCH / DELETE env vars
│               ├── test/
│               │   └── route.ts       Start/stop test server, proxy MCP calls
│               └── export/
│                   └── route.ts       Generate and stream ZIP download
├── components/
│   ├── builder/
│   │   ├── OverviewTab.tsx            Server name, description, version
│   │   ├── ToolsTab.tsx               Tool list + editor (name, schema, handler)
│   │   ├── SchemaBuilder.tsx          Visual parameter schema editor
│   │   ├── CodeEditor.tsx             Monaco editor wrapper (dynamic import)
│   │   ├── ResourcesTab.tsx           Resource list + editor (URI, MIME, handler)
│   │   ├── PromptsTab.tsx             Prompt list + editor (args, template)
│   │   ├── EnvVarsTab.tsx             Env variable CRUD with secret toggle
│   │   ├── TestTab.tsx                Built-in MCP inspector UI
│   │   └── ExportTab.tsx              Code preview + ZIP download
│   └── ui/                            Reusable shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       └── ...
├── lib/
│   ├── utils.ts                       cn() utility (clsx + tailwind-merge)
│   ├── db.ts                          Prisma client singleton
│   ├── codegen.ts                     Code generation engine
│   └── test-runner.ts                 Spawns/manages temp MCP test servers
└── types/
    └── mcp.ts                         Shared TypeScript interfaces

prisma/
├── schema.prisma                      Database schema
└── dev.db                             SQLite database file
```

## Database Schema

```
┌──────────────┐
│   Project    │
├──────────────┤       ┌──────────────┐
│ id (PK)      │──┐    │    Tool      │
│ name         │  │    ├──────────────┤
│ description  │  ├───▶│ id (PK)      │
│ version      │  │    │ projectId(FK)│
│ createdAt    │  │    │ name         │
│ updatedAt    │  │    │ description  │
└──────────────┘  │    │ inputSchema  │  ← JSON string of ParamField[]
                  │    │ handlerCode  │
                  │    └──────────────┘
                  │
                  │    ┌──────────────┐
                  │    │  Resource    │
                  │    ├──────────────┤
                  ├───▶│ id (PK)      │
                  │    │ projectId(FK)│
                  │    │ uri          │
                  │    │ name         │
                  │    │ description  │
                  │    │ mimeType     │
                  │    │ handlerCode  │
                  │    └──────────────┘
                  │
                  │    ┌──────────────┐
                  │    │   Prompt     │
                  │    ├──────────────┤
                  ├───▶│ id (PK)      │
                  │    │ projectId(FK)│
                  │    │ name         │
                  │    │ description  │
                  │    │ arguments    │  ← JSON string of PromptArgument[]
                  │    │ template     │
                  │    └──────────────┘
                  │
                  │    ┌──────────────┐
                  │    │ EnvVariable  │
                  │    ├──────────────┤
                  └───▶│ id (PK)      │
                       │ projectId(FK)│
                       │ key          │
                       │ value        │
                       │ description  │
                       └──────────────┘

All child tables cascade-delete when a Project is removed.
```

## Key Data Flows

### 1. Creating and Editing a Tool

```
User fills form ──▶ ToolsTab state ──▶ POST/PATCH /api/projects/[id]/tools/[toolId]
                                               │
                                               ▼
                                        Prisma upsert to SQLite
                                        (inputSchema stored as JSON string)
```

The `SchemaBuilder` component provides a visual form for defining parameters (name, type, description, required). It produces a `ParamField[]` array that is serialized to JSON for storage and later converted to Zod schema code during code generation.

### 2. Code Generation

```
codegen.ts
    │
    ├── generateServerCode(project, transport)
    │     Iterates tools/resources/prompts and produces:
    │     - Import statements (McpServer, transport, zod)
    │     - server.tool() registrations with Zod schemas
    │     - server.resource() registrations
    │     - server.prompt() registrations
    │     - Transport connection (stdio or Streamable HTTP)
    │
    ├── generatePackageJson(project, transport)
    ├── generateTsConfig()
    ├── generateDockerfile(project)
    ├── generateEnvExample(envVars)
    └── generateReadme(project)
```

ParamField types map to Zod as follows:

| ParamField type | Zod output                |
|-----------------|---------------------------|
| `string`        | `z.string()`              |
| `number`        | `z.number()`              |
| `boolean`       | `z.boolean()`             |
| `array`         | `z.array(z.string())`     |
| `object`        | `z.object({ ... })`       |

### 3. Testing (Built-in Inspector)

```
User clicks "Start Server"
         │
         ▼
POST /api/projects/[id]/test { action: "start" }
         │
         ▼
test-runner.ts:
  1. Generate server code (HTTP transport variant)
  2. Write to /tmp/mcp-test-{id}-{timestamp}/
  3. npm install
  4. npx tsx src/index.ts (on random port 3100–3999)
  5. Return { port, pid }
         │
         ▼
Inspector UI connects via API proxy:
  POST /api/projects/[id]/test { action: "call_tool", toolName, params }
         │
         ▼
  API route opens JSON-RPC session to localhost:{port}/mcp:
    → initialize handshake
    → notifications/initialized
    → tools/call (or resources/read, prompts/get)
    ← returns result to frontend
```

### 4. Exporting

```
User clicks "Download ZIP"
         │
         ▼
GET /api/projects/[id]/export?transport=stdio
         │
         ▼
export/route.ts:
  1. Load full project from DB
  2. Call all codegen functions
  3. archiver creates ZIP in memory:
       {name}/src/index.ts
       {name}/package.json
       {name}/tsconfig.json
       {name}/Dockerfile
       {name}/.env.example
       {name}/README.md
  4. Stream ZIP as response with Content-Disposition header
         │
         ▼
Browser downloads {name}-mcp-server.zip
```

## Generated MCP Server Structure

The exported ZIP contains a standalone project:

```
my-server/
├── src/
│   └── index.ts         MCP server using @modelcontextprotocol/sdk
├── package.json         Dependencies: sdk, zod, (express if HTTP)
├── tsconfig.json        ES2022 target, bundler resolution
├── Dockerfile           Multi-stage Node.js 22 build
├── .env.example         All configured env vars as placeholders
└── README.md            Setup, build, Docker, and inspector instructions
```

Two transport modes are supported:

- **stdio** (default) — communicates over stdin/stdout, suitable for local use with Claude Desktop, Cursor, etc.
- **HTTP** — Express server with Streamable HTTP transport on `/mcp`, suitable for remote deployment.

## Component Architecture

```
Dashboard (page.tsx)
├── CreateProjectDialog
└── ProjectCard[]
        │ click
        ▼
Builder (builder/[id]/page.tsx)
├── OverviewTab
│   └── form fields → PATCH /api/projects/[id]
├── ToolsTab
│   ├── Tool list sidebar
│   └── ToolEditor
│       ├── SchemaBuilder (recursive for nested objects)
│       └── CodeEditor (Monaco, dynamic import, SSR disabled)
├── ResourcesTab
│   ├── Resource list sidebar
│   └── ResourceEditor
│       └── CodeEditor
├── PromptsTab
│   ├── Prompt list sidebar
│   └── PromptEditor
│       └── Argument builder rows
├── EnvVarsTab
│   └── EnvVarRow[] (inline edit with save-on-change)
├── TestTab
│   ├── Server controls (Start/Stop)
│   ├── ToolsTester (select tool → fill params → execute)
│   ├── ResourcesTester (list → read)
│   ├── PromptsTester (select prompt → fill args → get)
│   └── Results log panel
└── ExportTab
    ├── Transport toggle (stdio / HTTP)
    ├── File overview cards
    ├── Code preview tabs (Monaco, read-only)
    └── Download ZIP button
```
