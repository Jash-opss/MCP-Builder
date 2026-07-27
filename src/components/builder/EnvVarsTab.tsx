"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { McpProject, EnvVar } from "@/types/mcp";
import { projectApiHeaders } from "@/lib/anon-id";

export function EnvVarsTab({ project, onUpdate }: { project: McpProject; onUpdate: () => void }) {
  const envVars = project.envVars || [];

  const addEnvVar = async () => {
    await fetch(`/api/projects/${project.id}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify({ key: "NEW_VARIABLE", value: "", description: "" }),
    });
    onUpdate();
  };

  const updateEnvVar = async (envVar: Partial<EnvVar> & { id: string }) => {
    await fetch(`/api/projects/${project.id}/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...projectApiHeaders() },
      body: JSON.stringify(envVar),
    });
    onUpdate();
  };

  const deleteEnvVar = async (envId: string) => {
    await fetch(`/api/projects/${project.id}/env?envId=${envId}`, { method: "DELETE", headers: projectApiHeaders() });
    onUpdate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Environment Variables
            </CardTitle>
            <CardDescription className="mt-1">
              Configure secrets and configuration values. These become environment variables
              in the generated server and are included in the <code>.env.example</code> file.
            </CardDescription>
          </div>
          <Button size="sm" onClick={addEnvVar}>
            <Plus className="mr-1 h-3 w-3" />
            Add Variable
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {envVars.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No environment variables configured.</p>
            <p className="text-xs mt-1">
              Add variables for database URLs, API keys, or other configuration.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {envVars.map((envVar) => (
              <EnvVarRow
                key={envVar.id}
                envVar={envVar}
                onUpdate={updateEnvVar}
                onDelete={() => deleteEnvVar(envVar.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EnvVarRow({
  envVar,
  onUpdate,
  onDelete,
}: {
  envVar: EnvVar;
  onUpdate: (envVar: Partial<EnvVar> & { id: string }) => void;
  onDelete: () => void;
}) {
  const [key, setKey] = useState(envVar.key);
  const [value, setValue] = useState(envVar.value);
  const [description, setDescription] = useState(envVar.description);
  const [showValue, setShowValue] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = () => {
    onUpdate({ id: envVar.id, key, value, description });
    setDirty(false);
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  return (
    <div className="grid grid-cols-[200px_1fr_1fr_auto_auto] gap-2 items-end rounded-lg border p-3">
      <div>
        <Label className="text-xs">Key</Label>
        <Input
          value={key}
          onChange={handleChange(setKey)}
          placeholder="MY_API_KEY"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="relative">
        <Label className="text-xs">Value</Label>
        <div className="relative">
          <Input
            type={showValue ? "text" : "password"}
            value={value}
            onChange={handleChange(setValue)}
            placeholder="secret-value"
            className="h-8 text-sm font-mono pr-8"
          />
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Input
          value={description}
          onChange={handleChange(setDescription)}
          placeholder="What is this variable for?"
          className="h-8 text-sm"
        />
      </div>
      {dirty ? (
        <Button size="icon" className="h-8 w-8" onClick={save}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <div className="h-8 w-8" />
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
