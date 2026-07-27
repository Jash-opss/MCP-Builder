"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor } from "@/components/builder/CodeEditor";
import type { McpProject, McpResource } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

export function ResourcesTab({ project, onUpdate }: { project: McpProject; onUpdate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    project.resources?.[0]?.id || null
  );
  const resources = project.resources || [];
  const selected = resources.find((r) => r.id === selectedId) || null;

  const addResource = async () => {
    const res = await fetch(`/api/projects/${project.id}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name: "new_resource", uri: "resource://example" }),
    });
    const resource = await res.json();
    await onUpdate();
    setSelectedId(resource.id);
  };

  const deleteResource = async (resourceId: string) => {
    await fetch(`/api/projects/${project.id}/resources/${resourceId}`, { method: "DELETE", headers: projectApiHeaders() });
    if (selectedId === resourceId) setSelectedId(null);
    onUpdate();
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[600px]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <Button size="sm" variant="outline" onClick={addResource}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {resources.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No resources yet. Click Add to create one.
              </p>
            ) : (
              <div className="space-y-1 p-2">
                {resources.map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => setSelectedId(resource.id)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      selectedId === resource.id ? "bg-accent" : ""
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{resource.name}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {selected ? (
        <ResourceEditor
          key={selected.id}
          resource={selected}
          projectId={project.id}
          onUpdate={onUpdate}
          onDelete={() => deleteResource(selected.id)}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Select a resource to edit or create a new one</p>
        </div>
      )}
    </div>
  );
}

function ResourceEditor({
  resource,
  projectId,
  onUpdate,
  onDelete,
}: {
  resource: McpResource;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(resource.name);
  const [uri, setUri] = useState(resource.uri);
  const [description, setDescription] = useState(resource.description);
  const [mimeType, setMimeType] = useState(resource.mimeType);
  const [handlerCode, setHandlerCode] = useState(resource.handlerCode);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name, uri, description, mimeType, handlerCode }),
    });
    setSaving(false);
    onUpdate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Resource
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
            <Label>Resource Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my_resource" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What data does this resource provide?"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>URI</Label>
            <Input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="resource://my-data" />
            <p className="text-xs text-muted-foreground">
              The URI that clients use to access this resource.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>MIME Type</Label>
            <Select value={mimeType} onValueChange={setMimeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text/plain">text/plain</SelectItem>
                <SelectItem value="application/json">application/json</SelectItem>
                <SelectItem value="text/html">text/html</SelectItem>
                <SelectItem value="text/markdown">text/markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-base mb-3 block">Handler Code</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Write the function body. You receive <code className="text-xs">uri</code> as a parameter.
            Return an object with <code className="text-xs">contents</code> array containing{" "}
            <code className="text-xs">{`{ uri, text: "..." }`}</code> items.
          </p>
          <CodeEditor value={handlerCode} onChange={setHandlerCode} language="typescript" height="250px" />
        </div>
      </CardContent>
    </Card>
  );
}
