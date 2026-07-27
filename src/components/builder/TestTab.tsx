"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Square, RefreshCw, Wrench, FileText, MessageSquare, Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { McpProject } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

interface ServerStatus {
  running: boolean;
  port?: number;
  pid?: number;
  error?: string;
  useInProcess?: boolean;
}

interface InspectorResult {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: string;
}

export function TestTab({ project }: { project: McpProject }) {
  const [status, setStatus] = useState<ServerStatus>({ running: false });
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState<InspectorResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/test`, { headers: projectApiHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.useInProcess && data.running) {
          setStatus({
            running: true,
            port: data.port ?? 0,
            useInProcess: true,
          });
        } else if (data.running) {
          setStatus({
            running: true,
            port: data.port,
            pid: data.pid,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [project.id]);

  const startServer = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...projectApiHeaders() },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus({ running: false, error: data.error });
      } else {
        setStatus({
          running: true,
          port: data.port,
          pid: data.pid,
          useInProcess: data.useInProcess,
        });
      }
    } catch (err) {
      setStatus({ running: false, error: String(err) });
    }
    setStarting(false);
  };

  const stopServer = async () => {
    await fetch(`/api/projects/${project.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ action: "stop" }),
    });
    setStatus({ running: false });
  };

  const addResult = useCallback((result: InspectorResult) => {
    setResults((prev) => [result, ...prev]);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                MCP Inspector
                {status.running && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {status.useInProcess
                      ? "Running (in-browser test)"
                      : `Running on port ${status.port}`}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Start a test server and interactively test your tools, resources, and prompts.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {status.running ? (
                <Button variant="destructive" onClick={stopServer}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop Server
                </Button>
              ) : (
                <Button onClick={startServer} disabled={starting}>
                  {starting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {starting ? "Starting..." : "Start Server"}
                </Button>
              )}
            </div>
          </div>
          {status.error && (
            <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="inline mr-2 h-4 w-4" />
              {status.error}
            </div>
          )}
        </CardHeader>
      </Card>

      {status.running && (status.port != null || status.useInProcess) && (
        <div className="grid grid-cols-[1fr_350px] gap-6">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="tools">
                <TabsList>
                  <TabsTrigger value="tools">
                    <Wrench className="mr-1 h-3.5 w-3.5" />
                    Tools ({project.tools?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="resources">
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    Resources ({project.resources?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="prompts">
                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                    Prompts ({project.prompts?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tools" className="mt-4">
                  <ToolsTester
                    project={project}
                    port={status.port ?? 0}
                    onResult={addResult}
                  />
                </TabsContent>
                <TabsContent value="resources" className="mt-4">
                  <ResourcesTester
                    project={project}
                    port={status.port ?? 0}
                    onResult={addResult}
                  />
                </TabsContent>
                <TabsContent value="prompts" className="mt-4">
                  <PromptsTester
                    project={project}
                    port={status.port ?? 0}
                    onResult={addResult}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Results Log</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResults([])}
                  disabled={results.length === 0}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {results.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No results yet. Execute a tool or read a resource to see results here.
                  </p>
                ) : (
                  <div className="space-y-2 p-3">
                    {results.map((result, i) => (
                      <div
                        key={i}
                        className={`rounded-md border p-3 text-sm ${
                          result.success ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {result.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                          )}
                          <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-xs font-mono mt-1 overflow-auto max-h-40">
                          {result.error || JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ToolsTester({
  project,
  port,
  onResult,
}: {
  project: McpProject;
  port: number;
  onResult: (r: InspectorResult) => void;
}) {
  const [selectedTool, setSelectedTool] = useState<string>(project.tools?.[0]?.name || "");
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const tools = project.tools || [];
  const tool = tools.find((t) => t.name === selectedTool);

  const executeTool = async () => {
    if (!tool) return;
    setLoading(true);

    try {
      const parsedParams: Record<string, unknown> = {};
      tool.inputSchema.forEach((field) => {
        const val = params[field.name];
        if (val === undefined || val === "") return;
        switch (field.type) {
          case "number":
            parsedParams[field.name] = Number(val);
            break;
          case "boolean":
            parsedParams[field.name] = val === "true";
            break;
          default:
            parsedParams[field.name] = val;
        }
      });

      const res = await fetch(`/api/projects/${project.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...projectApiHeaders() },
        body: JSON.stringify({
          action: "call_tool",
          port,
          toolName: tool.name,
          params: parsedParams,
        }),
      });
      const data = await res.json();
      onResult({
        success: !data.error,
        data: data.error ? undefined : data,
        error: data.error,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      onResult({
        success: false,
        error: String(err),
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tools defined in this project.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {tools.map((t) => (
              <Button
                key={t.name}
                variant={selectedTool === t.name ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedTool(t.name);
                  setParams({});
                }}
              >
                <Wrench className="mr-1 h-3 w-3" />
                {t.name}
              </Button>
            ))}
          </div>

          {tool && (
            <>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
              <Separator />
              {tool.inputSchema.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Parameters</Label>
                  {tool.inputSchema.map((field) => (
                    <div key={field.name} className="grid gap-1">
                      <Label className="text-xs">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        <span className="text-muted-foreground ml-2">({field.type})</span>
                      </Label>
                      <Input
                        value={params[field.name] || ""}
                        onChange={(e) => setParams({ ...params, [field.name]: e.target.value })}
                        placeholder={field.description || field.name}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={executeTool} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {loading ? "Executing..." : `Execute ${tool.name}`}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ResourcesTester({
  project,
  port,
  onResult,
}: {
  project: McpProject;
  port: number;
  onResult: (r: InspectorResult) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const resources = project.resources || [];

  const readResource = async (uri: string) => {
    setLoading(uri);
    try {
      const res = await fetch(`/api/projects/${project.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...projectApiHeaders() },
        body: JSON.stringify({ action: "read_resource", port, uri }),
      });
      const data = await res.json();
      onResult({
        success: !data.error,
        data: data.error ? undefined : data,
        error: data.error,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      onResult({
        success: false,
        error: String(err),
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    setLoading(null);
  };

  return (
    <div className="space-y-3">
      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resources defined in this project.</p>
      ) : (
        resources.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.uri}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => readResource(r.uri)}
              disabled={loading === r.uri}
            >
              {loading === r.uri ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <FileText className="mr-1 h-3 w-3" />
              )}
              Read
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

function PromptsTester({
  project,
  port,
  onResult,
}: {
  project: McpProject;
  port: number;
  onResult: (r: InspectorResult) => void;
}) {
  const [selectedPrompt, setSelectedPrompt] = useState<string>(project.prompts?.[0]?.name || "");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const prompts = project.prompts || [];
  const prompt = prompts.find((p) => p.name === selectedPrompt);

  const testPrompt = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...projectApiHeaders() },
        body: JSON.stringify({
          action: "get_prompt",
          port,
          promptName: prompt.name,
          args,
        }),
      });
      const data = await res.json();
      onResult({
        success: !data.error,
        data: data.error ? undefined : data,
        error: data.error,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      onResult({
        success: false,
        error: String(err),
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prompts defined in this project.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <Button
                key={p.name}
                variant={selectedPrompt === p.name ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedPrompt(p.name);
                  setArgs({});
                }}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                {p.name}
              </Button>
            ))}
          </div>

          {prompt && (
            <>
              <p className="text-sm text-muted-foreground">{prompt.description}</p>
              <Separator />
              {prompt.arguments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Arguments</Label>
                  {prompt.arguments.map((arg) => (
                    <div key={arg.name} className="grid gap-1">
                      <Label className="text-xs">
                        {arg.name}
                        {arg.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <Input
                        value={args[arg.name] || ""}
                        onChange={(e) => setArgs({ ...args, [arg.name]: e.target.value })}
                        placeholder={arg.description || arg.name}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={testPrompt} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {loading ? "Getting prompt..." : `Get ${prompt.name}`}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
