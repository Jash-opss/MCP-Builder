"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { McpProject } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

export function OverviewTab({ project, onUpdate }: { project: McpProject; onUpdate: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [version, setVersion] = useState(project.version);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name, description, version }),
    });
    setSaving(false);
    onUpdate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Configuration</CardTitle>
        <CardDescription>Configure the basic metadata for your MCP server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="server-name">Server Name</Label>
          <Input
            id="server-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-mcp-server"
          />
          <p className="text-xs text-muted-foreground">
            Used as the server identifier in the MCP protocol. Use lowercase with hyphens.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="server-desc">Description</Label>
          <Textarea
            id="server-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what your MCP server does..."
            rows={3}
          />
        </div>
        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="server-version">Version</Label>
          <Input
            id="server-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
          />
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
