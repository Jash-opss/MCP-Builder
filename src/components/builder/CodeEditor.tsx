"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-md border bg-muted" style={{ height: 250 }}>
      <span className="text-sm text-muted-foreground">Loading editor...</span>
    </div>
  ),
});

export function CodeEditor({
  value,
  onChange,
  language = "typescript",
  height = "250px",
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-md border overflow-hidden">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange?.(val || "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          readOnly,
          padding: { top: 8 },
          automaticLayout: true,
        }}
      />
    </div>
  );
}
