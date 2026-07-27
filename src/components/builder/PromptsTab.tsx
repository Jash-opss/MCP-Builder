"use client";

import { useState } from "react";
import { Plus, Trash2, MessageSquare, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { McpProject, McpPrompt, PromptArgument } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

export function PromptsTab({ project, onUpdate }: { project: McpProject; onUpdate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    project.prompts?.[0]?.id || null
  );
  const prompts = project.prompts || [];
  const selected = prompts.find((p) => p.id === selectedId) || null;

  const addPrompt = async () => {
    const res = await fetch(`/api/projects/${project.id}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name: "new_prompt", description: "A new prompt" }),
    });
    const prompt = await res.json();
    await onUpdate();
    setSelectedId(prompt.id);
  };

  const deletePrompt = async (promptId: string) => {
    await fetch(`/api/projects/${project.id}/prompts/${promptId}`, { method: "DELETE", headers: projectApiHeaders() });
    if (selectedId === promptId) setSelectedId(null);
    onUpdate();
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[600px]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Prompts</CardTitle>
            <Button size="sm" variant="outline" onClick={addPrompt}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {prompts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No prompts yet. Click Add to create one.
              </p>
            ) : (
              <div className="space-y-1 p-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => setSelectedId(prompt.id)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      selectedId === prompt.id ? "bg-accent" : ""
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{prompt.name}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {selected ? (
        <PromptEditor
          key={selected.id}
          prompt={selected}
          projectId={project.id}
          onUpdate={onUpdate}
          onDelete={() => deletePrompt(selected.id)}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Select a prompt to edit or create a new one</p>
        </div>
      )}
    </div>
  );
}

function PromptEditor({
  prompt,
  projectId,
  onUpdate,
  onDelete,
}: {
  prompt: McpPrompt;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description);
  const [args, setArgs] = useState<PromptArgument[]>(prompt.arguments);
  const [template, setTemplate] = useState(prompt.template);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/prompts/${prompt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ name, description, arguments: args, template }),
    });
    setSaving(false);
    onUpdate();
  };

  const addArg = () => {
    setArgs([...args, { name: "", description: "", required: false }]);
  };

  const updateArg = (index: number, updates: Partial<PromptArgument>) => {
    setArgs(args.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const removeArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Edit Prompt
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
            <Label>Prompt Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my_prompt" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this prompt do?"
            />
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Arguments</Label>
            <Button variant="outline" size="sm" onClick={addArg}>
              <Plus className="mr-1 h-3 w-3" />
              Add Argument
            </Button>
          </div>
          {args.length === 0 ? (
            <p className="text-sm text-muted-foreground">No arguments defined.</p>
          ) : (
            <div className="space-y-3">
              {args.map((arg, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end rounded-lg border p-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={arg.name}
                      onChange={(e) => updateArg(index, { name: e.target.value })}
                      placeholder="arg_name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={arg.description}
                      onChange={(e) => updateArg(index, { description: e.target.value })}
                      placeholder="Argument description"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-0.5">
                    <Switch
                      checked={arg.required}
                      onCheckedChange={(checked) => updateArg(index, { required: checked })}
                    />
                    <Label className="text-xs">Required</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeArg(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-base mb-3 block">Prompt Template</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Write your prompt template. Use <code className="text-xs">{`{{argName}}`}</code> to
            insert argument values.
          </p>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="You are a helpful assistant. The user wants help with {{topic}}..."
            rows={8}
            className="font-mono text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
