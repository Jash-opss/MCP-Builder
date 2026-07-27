export interface ParamField {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
  children?: ParamField[];
  itemType?: "string" | "number" | "boolean";
}

export type ToolHandlerType = "code" | "http_request" | "db_query";

export interface HttpRequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: { key: string; value: string }[];
  bodyTemplate: string;
  responseMapping: string;
}

export type SqlDbType = "postgresql" | "mysql" | "sqlite";
export type VectorDbType = "pinecone" | "chromadb" | "qdrant";
export type AllDbType = SqlDbType | VectorDbType;

export interface DbQueryConfig {
  dbType: AllDbType;
  connectionEnvVar: string;
  query: string;
  collection?: string;
  topK?: number;
  namespace?: string;
}

export type ToolHandlerConfig = HttpRequestConfig | DbQueryConfig | Record<string, never>;

export interface McpTool {
  id: string;
  projectId: string;
  name: string;
  description: string;
  inputSchema: ParamField[];
  handlerType: ToolHandlerType;
  handlerCode: string;
  handlerConfig: ToolHandlerConfig;
}

export interface McpResource {
  id: string;
  projectId: string;
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handlerCode: string;
}

export interface McpPrompt {
  id: string;
  projectId: string;
  name: string;
  description: string;
  arguments: PromptArgument[];
  template: string;
}

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface EnvVar {
  id: string;
  projectId: string;
  key: string;
  value: string;
  description: string;
}

export interface McpProject {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  tools?: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
  envVars?: EnvVar[];
}
