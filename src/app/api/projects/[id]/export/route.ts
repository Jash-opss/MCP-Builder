import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";
import archiver from "archiver";
import { PassThrough } from "stream";
import {
  generateServerCode,
  generatePackageJson,
  generateTsConfig,
  generateDockerfile,
  generateEnvExample,
  generateReadme,
  type TransportMode,
} from "@/lib/codegen";
import type { McpProject } from "@/types/mcp";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const transport = (searchParams.get("transport") || "sse") as TransportMode;

  const fullProject = await prisma.project.findUnique({
    where: { id },
    include: { tools: true, resources: true, prompts: true, envVars: true },
  });

  if (!fullProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mcpProject: McpProject = {
    ...fullProject,
    createdAt: fullProject.createdAt.toISOString(),
    updatedAt: fullProject.updatedAt.toISOString(),
    tools: fullProject.tools.map((t) => ({
      ...t,
      handlerType: t.handlerType as "code" | "http_request" | "db_query",
      inputSchema: JSON.parse(t.inputSchema),
      handlerConfig: JSON.parse(t.handlerConfig),
    })),
    prompts: fullProject.prompts.map((p) => ({
      ...p,
      arguments: JSON.parse(p.arguments),
    })),
  };

  const serverCode = generateServerCode(mcpProject, transport);
  const packageJson = generatePackageJson(mcpProject, transport);
  const tsConfig = generateTsConfig();
  const dockerfile = generateDockerfile(mcpProject);
  const envExample = generateEnvExample(mcpProject.envVars || []);
  const readme = generateReadme(mcpProject);

  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(passThrough);

  const prefix = mcpProject.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  archive.append(serverCode, { name: `${prefix}/src/index.ts` });
  archive.append(packageJson, { name: `${prefix}/package.json` });
  archive.append(tsConfig, { name: `${prefix}/tsconfig.json` });
  archive.append(dockerfile, { name: `${prefix}/Dockerfile` });
  archive.append(envExample, { name: `${prefix}/.env.example` });
  archive.append(readme, { name: `${prefix}/README.md` });

  await archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passThrough) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${prefix}-mcp-server.zip"`,
    },
  });
}
