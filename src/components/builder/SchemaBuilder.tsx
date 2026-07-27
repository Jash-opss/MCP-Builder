"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ParamField } from "@/types/mcp";

const TYPES = ["string", "number", "boolean", "object", "array"] as const;

export function SchemaBuilder({
  fields,
  onChange,
  depth = 0,
}: {
  fields: ParamField[];
  onChange: (fields: ParamField[]) => void;
  depth?: number;
}) {
  const addField = () => {
    onChange([
      ...fields,
      { name: "", type: "string", description: "", required: false },
    ]);
  };

  const updateField = (index: number, updates: Partial<ParamField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...updates } : f));
    onChange(updated);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={index}
          className="rounded-lg border p-3 space-y-3"
          style={{ marginLeft: depth * 16 }}
        >
          <div className="grid grid-cols-[1fr_120px_1fr_auto_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={field.name}
                onChange={(e) => updateField(index, { name: e.target.value })}
                placeholder="param_name"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select
                value={field.type}
                onValueChange={(v) =>
                  updateField(index, {
                    type: v as ParamField["type"],
                    ...(v === "object" ? { children: field.children || [] } : {}),
                    ...(v === "array" ? { itemType: field.itemType || "string" } : {}),
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={field.description}
                onChange={(e) => updateField(index, { description: e.target.value })}
                placeholder="Parameter description"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => updateField(index, { required: checked })}
              />
              <Label className="text-xs">Required</Label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeField(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {field.type === "array" && (
            <div className="pl-4">
              <Label className="text-xs">Array Item Type</Label>
              <Select
                value={field.itemType || "string"}
                onValueChange={(v) => updateField(index, { itemType: v as ParamField["itemType"] })}
              >
                <SelectTrigger className="h-8 text-sm w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "object" && (
            <div className="pl-4 border-l-2 border-muted ml-2">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Nested Properties
              </Label>
              <SchemaBuilder
                fields={field.children || []}
                onChange={(children) => updateField(index, { children })}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addField} className="w-full">
        <Plus className="mr-1 h-3 w-3" />
        Add Parameter
      </Button>
    </div>
  );
}
