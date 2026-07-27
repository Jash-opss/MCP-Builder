"use client";

import { useState } from "react";
import {
  Plus, Trash2, Wrench, Save, ChevronRight, Code, Globe, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SchemaBuilder } from "@/components/builder/SchemaBuilder";
import { CodeEditor } from "@/components/builder/CodeEditor";
import type {
  McpProject, McpTool, ParamField, ToolHandlerType, ToolHandlerConfig,
  HttpRequestConfig, DbQueryConfig, AllDbType, VectorDbType,
} from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

const HANDLER_TYPES: { value: ToolHandlerType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "code",
    label: "Custom Code",
    icon: <Code className="h-5 w-5" />,
    description: "Write TypeScript handler code directly",
  },
  {
    value: "http_request",
    label: "HTTP API Call",
    icon: <Globe className="h-5 w-5" />,
    description: "Call an external REST API endpoint",
  },
  {
    value: "db_query",
    label: "Database / Vector DB",
    icon: <Database className="h-5 w-5" />,
    description: "SQL database or vector DB search",
  },
];

const DEFAULT_HTTP_CONFIG: HttpRequestConfig = {
  url: "https://api.example.com/endpoint",
  method: "GET",
  headers: [],
  bodyTemplate: "",
  responseMapping: "",
};

const DEFAULT_DB_CONFIG: DbQueryConfig = {
  dbType: "postgresql",
  connectionEnvVar: "DATABASE_URL",
  query: "SELECT * FROM table_name WHERE id = {{id}}",
};

function handlerTypeIcon(type: ToolHandlerType) {
  switch (type) {
    case "code": return <Code className="h-3.5 w-3.5" />;
    case "http_request": return <Globe className="h-3.5 w-3.5" />;
    case "db_query": return <Database className="h-3.5 w-3.5" />;
  }
}

export function ToolsTab({ project, onUpdate }: { project: McpProject; onUpdate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    project.tools?.[0]?.id || null
  );
  const tools = project.tools || [];
  const selected = tools.find((t) => t.id === selectedId) || null;

  const addTool = async () => {
    const res = await fetch(`/api/projects/${project.id}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name: "new_tool", description: "A new tool" }),
    });
    const tool = await res.json();
    await onUpdate();
    setSelectedId(tool.id);
  };

  const deleteTool = async (toolId: string) => {
    await fetch(`/api/projects/${project.id}/tools/${toolId}`, { method: "DELETE", headers: projectApiHeaders() });
    if (selectedId === toolId) setSelectedId(null);
    onUpdate();
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[600px]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Tools</CardTitle>
            <Button size="sm" variant="outline" onClick={addTool}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {tools.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No tools yet. Click Add to create one.
              </p>
            ) : (
              <div className="space-y-1 p-2">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedId(tool.id)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      selectedId === tool.id ? "bg-accent" : ""
                    }`}
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {handlerTypeIcon(tool.handlerType || "code")}
                    </span>
                    <span className="truncate font-medium">{tool.name}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {selected ? (
        <ToolEditor
          key={selected.id}
          tool={selected}
          projectId={project.id}
          onUpdate={onUpdate}
          onDelete={() => deleteTool(selected.id)}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Select a tool to edit or create a new one</p>
        </div>
      )}
    </div>
  );
}

function ToolEditor({
  tool,
  projectId,
  onUpdate,
  onDelete,
}: {
  tool: McpTool;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [inputSchema, setInputSchema] = useState<ParamField[]>(tool.inputSchema);
  const [handlerType, setHandlerType] = useState<ToolHandlerType>(tool.handlerType || "code");
  const [handlerCode, setHandlerCode] = useState(tool.handlerCode);
  const [handlerConfig, setHandlerConfig] = useState<ToolHandlerConfig>(
    tool.handlerConfig && Object.keys(tool.handlerConfig).length > 0
      ? tool.handlerConfig
      : {}
  );
  const [saving, setSaving] = useState(false);

  const switchHandlerType = (newType: ToolHandlerType) => {
    setHandlerType(newType);
    if (newType === "http_request" && !(handlerConfig as HttpRequestConfig).url) {
      setHandlerConfig({ ...DEFAULT_HTTP_CONFIG });
    } else if (newType === "db_query" && !(handlerConfig as DbQueryConfig).query) {
      setHandlerConfig({ ...DEFAULT_DB_CONFIG });
    } else if (newType === "code") {
      if (!handlerCode) {
        setHandlerCode('return { content: [{ type: "text", text: "Hello from tool!" }] };');
      }
    }
  };

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/tools/${tool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name, description, inputSchema, handlerType, handlerCode, handlerConfig }),
    });
    setSaving(false);
    onUpdate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Edit Tool
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="mr-1 h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Tool Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my_tool" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this tool do?"
            />
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Input Parameters</Label>
            <Badge variant="secondary">{inputSchema.length} params</Badge>
          </div>
          <SchemaBuilder fields={inputSchema} onChange={setInputSchema} />
        </div>

        <Separator />

        <div>
          <Label className="text-base mb-3 block">Handler Type</Label>
          <div className="grid grid-cols-3 gap-3">
            {HANDLER_TYPES.map((ht) => (
              <button
                key={ht.value}
                type="button"
                onClick={() => switchHandlerType(ht.value)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all cursor-pointer ${
                  handlerType === ht.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={handlerType === ht.value ? "text-primary" : "text-muted-foreground"}>
                  {ht.icon}
                </div>
                <span className="text-sm font-medium">{ht.label}</span>
                <span className="text-xs text-muted-foreground">{ht.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {handlerType === "code" && (
          <CodeHandlerEditor code={handlerCode} onChange={setHandlerCode} />
        )}
        {handlerType === "http_request" && (
          <HttpHandlerEditor
            config={(handlerConfig as HttpRequestConfig).url ? handlerConfig as HttpRequestConfig : DEFAULT_HTTP_CONFIG}
            onChange={(c) => setHandlerConfig(c)}
          />
        )}
        {handlerType === "db_query" && (
          <DbHandlerEditor
            config={(handlerConfig as DbQueryConfig).query ? handlerConfig as DbQueryConfig : DEFAULT_DB_CONFIG}
            onChange={(c) => setHandlerConfig(c)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CodeHandlerEditor({ code, onChange }: { code: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-base mb-3 block">Handler Code</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Write the function body. You receive the destructured parameters as variables.
        Return an object with <code className="text-xs">content</code> array containing{" "}
        <code className="text-xs">{`{ type: "text", text: "..." }`}</code> items.
      </p>
      <CodeEditor value={code} onChange={onChange} language="typescript" height="250px" />
    </div>
  );
}

function HttpHandlerEditor({
  config,
  onChange,
}: {
  config: HttpRequestConfig;
  onChange: (c: HttpRequestConfig) => void;
}) {
  const addHeader = () => {
    onChange({ ...config, headers: [...config.headers, { key: "", value: "" }] });
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    const headers = config.headers.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    );
    onChange({ ...config, headers });
  };

  const removeHeader = (index: number) => {
    onChange({ ...config, headers: config.headers.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base mb-1 block">HTTP API Call</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Configure the external API to call. Use <code className="text-xs">{`{{param_name}}`}</code> in
          URL, headers, or body to insert parameter values.
        </p>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-3">
        <div className="grid gap-2">
          <Label className="text-xs">Method</Label>
          <Select value={config.method} onValueChange={(v) => onChange({ ...config, method: v as HttpRequestConfig["method"] })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">URL</Label>
          <Input
            value={config.url}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder="https://api.example.com/{{resource}}"
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Headers</Label>
          <Button variant="outline" size="sm" onClick={addHeader} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Add Header
          </Button>
        </div>
        {config.headers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No custom headers.</p>
        ) : (
          <div className="space-y-2">
            {config.headers.map((header, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Input
                  value={header.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  placeholder="Header-Name"
                  className="h-8 text-sm font-mono"
                />
                <Input
                  value={header.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  placeholder="value or {{env_var}}"
                  className="h-8 text-sm font-mono"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeHeader(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {config.method !== "GET" && (
        <div className="grid gap-2">
          <Label className="text-xs">Request Body Template (JSON)</Label>
          <Textarea
            value={config.bodyTemplate}
            onChange={(e) => onChange({ ...config, bodyTemplate: e.target.value })}
            placeholder={'{\n  "query": "{{search_term}}",\n  "limit": 10\n}'}
            rows={5}
            className="font-mono text-sm"
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label className="text-xs">Response Mapping (optional)</Label>
        <p className="text-xs text-muted-foreground">
          JavaScript expression to transform the response. Use <code className="text-xs">data</code> to
          refer to the parsed JSON response. Leave empty to return the full response.
        </p>
        <Input
          value={config.responseMapping}
          onChange={(e) => onChange({ ...config, responseMapping: e.target.value })}
          placeholder='data.results.map(r => r.name).join(", ")'
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

const VECTOR_DBS: VectorDbType[] = ["pinecone", "chromadb", "qdrant"];
const isVectorDb = (dbType: AllDbType): dbType is VectorDbType => VECTOR_DBS.includes(dbType as VectorDbType);

const DB_LABELS: Record<AllDbType, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  pinecone: "Pinecone",
  chromadb: "ChromaDB",
  qdrant: "Qdrant",
};

const CONNECTION_PLACEHOLDERS: Partial<Record<AllDbType, string>> = {
  postgresql: "DATABASE_URL",
  mysql: "DATABASE_URL",
  sqlite: "SQLITE_PATH",
  pinecone: "PINECONE_API_KEY",
  chromadb: "CHROMA_URL",
  qdrant: "QDRANT_URL",
};

function DbHandlerEditor({
  config,
  onChange,
}: {
  config: DbQueryConfig;
  onChange: (c: DbQueryConfig) => void;
}) {
  const vector = isVectorDb(config.dbType);

  const switchDbType = (v: AllDbType) => {
    const wasVector = isVectorDb(config.dbType);
    const nowVector = isVectorDb(v);

    const patch: Partial<DbQueryConfig> = {
      dbType: v,
      connectionEnvVar: CONNECTION_PLACEHOLDERS[v] || "DATABASE_URL",
    };

    if (!wasVector && nowVector) {
      patch.collection = "my_collection";
      patch.topK = 5;
      patch.namespace = "";
      patch.query = "{{query}}";
    } else if (wasVector && !nowVector) {
      patch.query = "SELECT * FROM table_name WHERE id = {{id}}";
      patch.collection = undefined;
      patch.topK = undefined;
      patch.namespace = undefined;
    }

    onChange({ ...config, ...patch });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base mb-1 block">
          {vector ? "Vector DB Search" : "Database Query"}
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          {vector ? (
            <>
              Configure a vector similarity search. Use <code className="text-xs">{`{{param_name}}`}</code> in
              the query text to insert parameter values. API key / URL should be set in the Env Vars tab.
            </>
          ) : (
            <>
              Configure a SQL query to run. Use <code className="text-xs">{`{{param_name}}`}</code> in
              the query to insert parameter values. Connection string should be set as an environment
              variable in the Env Vars tab.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className="text-xs">Database Type</Label>
          <Select value={config.dbType} onValueChange={(v) => switchDbType(v as AllDbType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="pinecone">Pinecone</SelectItem>
              <SelectItem value="chromadb">ChromaDB</SelectItem>
              <SelectItem value="qdrant">Qdrant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">
            {vector ? "API Key / URL Env Variable" : "Connection Env Variable"}
          </Label>
          <Input
            value={config.connectionEnvVar}
            onChange={(e) => onChange({ ...config, connectionEnvVar: e.target.value })}
            placeholder={CONNECTION_PLACEHOLDERS[config.dbType] || "DATABASE_URL"}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Define this in the Env Vars tab.
          </p>
        </div>
      </div>

      {vector ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs">
                {config.dbType === "pinecone" ? "Index Name" : "Collection Name"}
              </Label>
              <Input
                value={config.collection || ""}
                onChange={(e) => onChange({ ...config, collection: e.target.value })}
                placeholder="my_collection"
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Top K Results</Label>
              <Input
                type="number"
                value={config.topK ?? 5}
                onChange={(e) => onChange({ ...config, topK: parseInt(e.target.value) || 5 })}
                min={1}
                max={100}
                className="font-mono text-sm"
              />
            </div>
            {config.dbType === "pinecone" && (
              <div className="grid gap-2">
                <Label className="text-xs">Namespace (optional)</Label>
                <Input
                  value={config.namespace || ""}
                  onChange={(e) => onChange({ ...config, namespace: e.target.value })}
                  placeholder="default"
                  className="font-mono text-sm"
                />
              </div>
            )}
            {config.dbType === "qdrant" && (
              <div className="grid gap-2">
                <Label className="text-xs">API Key Env Var (optional)</Label>
                <Input
                  value={config.namespace || ""}
                  onChange={(e) => onChange({ ...config, namespace: e.target.value })}
                  placeholder="QDRANT_API_KEY"
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">Query Text Template</Label>
            <Textarea
              value={config.query}
              onChange={(e) => onChange({ ...config, query: e.target.value })}
              placeholder="{{query}}"
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The text to embed and search for. Use <code className="text-xs">{`{{param}}`}</code> to
              insert tool parameter values.
            </p>
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label className="text-xs">SQL Query</Label>
          <CodeEditor
            value={config.query}
            onChange={(v) => onChange({ ...config, query: v })}
            language="sql"
            height="180px"
          />
          <p className="text-xs text-muted-foreground">
            Use <code className="text-xs">{`{{param}}`}</code> for parameter placeholders.
            They are passed as parameterized queries to prevent SQL injection.
          </p>
        </div>
      )}
    </div>
  );
}
