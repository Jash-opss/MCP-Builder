"use client";

import { useState } from "react";
import { Download, FileCode, Package, Container, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CodeEditor } from "@/components/builder/CodeEditor";
import {
  generateServerCode,
  generatePackageJson,
  generateTsConfig,
  generateDockerfile,
  generateEnvExample,
  generateReadme,
} from "@/lib/codegen";
import type { McpProject } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

export function ExportTab({ project }: { project: McpProject }) {
  const [downloading, setDownloading] = useState(false);
  const [transport] = useState<"http">("http");

  const serverCode = generateServerCode(project, transport);
  const packageJson = generatePackageJson(project, transport);
  const tsConfig = generateTsConfig();
  const dockerfile = generateDockerfile(project);
  const envExample = generateEnvExample(project.envVars || []);
  const readme = generateReadme(project);

  const downloadZip = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/export?transport=${transport}`, {
        headers: projectApiHeaders(),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-mcp-server.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download: " + String(err));
    }
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Export Project
              </CardTitle>
              <CardDescription>
                Download your MCP server as a complete, ready-to-run project with Docker support.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={downloadZip} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading ? "Generating..." : "Download ZIP"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <FileCode className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm font-medium">index.ts</p>
              <p className="text-xs text-muted-foreground">Server code</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm font-medium">package.json</p>
              <p className="text-xs text-muted-foreground">Dependencies</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Container className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-sm font-medium">Dockerfile</p>
              <p className="text-xs text-muted-foreground">Container config</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-sm font-medium">README.md</p>
              <p className="text-xs text-muted-foreground">Documentation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Code Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="server">
            <TabsList>
              <TabsTrigger value="server">src/index.ts</TabsTrigger>
              <TabsTrigger value="package">package.json</TabsTrigger>
              <TabsTrigger value="tsconfig">tsconfig.json</TabsTrigger>
              <TabsTrigger value="dockerfile">Dockerfile</TabsTrigger>
              <TabsTrigger value="env">.env.example</TabsTrigger>
              <TabsTrigger value="readme">README.md</TabsTrigger>
            </TabsList>

            <TabsContent value="server" className="mt-3">
              <CodeEditor value={serverCode} language="typescript" height="500px" readOnly />
            </TabsContent>
            <TabsContent value="package" className="mt-3">
              <CodeEditor value={packageJson} language="json" height="300px" readOnly />
            </TabsContent>
            <TabsContent value="tsconfig" className="mt-3">
              <CodeEditor value={tsConfig} language="json" height="200px" readOnly />
            </TabsContent>
            <TabsContent value="dockerfile" className="mt-3">
              <CodeEditor value={dockerfile} language="dockerfile" height="250px" readOnly />
            </TabsContent>
            <TabsContent value="env" className="mt-3">
              <CodeEditor value={envExample} language="plaintext" height="150px" readOnly />
            </TabsContent>
            <TabsContent value="readme" className="mt-3">
              <CodeEditor value={readme} language="markdown" height="350px" readOnly />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
