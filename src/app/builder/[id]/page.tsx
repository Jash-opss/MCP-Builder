"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { McpProject } from "@/types/mcp";
import { OverviewTab } from "@/components/builder/OverviewTab";
import { ToolsTab } from "@/components/builder/ToolsTab";
import { ResourcesTab } from "@/components/builder/ResourcesTab";
import { PromptsTab } from "@/components/builder/PromptsTab";
import { EnvVarsTab } from "@/components/builder/EnvVarsTab";
import { TestTab } from "@/components/builder/TestTab";
import { ExportTab } from "@/components/builder/ExportTab";
import { projectApiHeaders } from "@/lib/anon-id";

export default function BuilderPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<McpProject | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`, { headers: projectApiHeaders() });
    if (!res.ok) {
      router.push("/");
      return;
    }
    const data = await res.json();
    data.tools = data.tools.map((t: Record<string, unknown>) => ({
      ...t,
      inputSchema: typeof t.inputSchema === "string" ? JSON.parse(t.inputSchema as string) : t.inputSchema,
      handlerConfig: typeof t.handlerConfig === "string" ? JSON.parse(t.handlerConfig as string) : t.handlerConfig,
    }));
    data.prompts = data.prompts.map((p: Record<string, unknown>) => ({
      ...p,
      arguments: typeof p.arguments === "string" ? JSON.parse(p.arguments as string) : p.arguments,
    }));
    setProject(data);
    setLoading(false);
  }, [projectId, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  if (loading || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Server className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">{project.name}</h1>
            <p className="text-xs text-muted-foreground">v{project.version}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="env">Env Vars</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab project={project} onUpdate={fetchProject} />
          </TabsContent>
          <TabsContent value="tools">
            <ToolsTab project={project} onUpdate={fetchProject} />
          </TabsContent>
          <TabsContent value="resources">
            <ResourcesTab project={project} onUpdate={fetchProject} />
          </TabsContent>
          <TabsContent value="prompts">
            <PromptsTab project={project} onUpdate={fetchProject} />
          </TabsContent>
          <TabsContent value="env">
            <EnvVarsTab project={project} onUpdate={fetchProject} />
          </TabsContent>
          <TabsContent value="test">
            <TestTab project={project} />
          </TabsContent>
          <TabsContent value="export">
            <ExportTab project={project} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
