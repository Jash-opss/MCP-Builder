import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tools = await prisma.tool.findMany({ where: { projectId: id } });
  return NextResponse.json(tools);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const tool = await prisma.tool.create({
    data: {
      projectId: id,
      name: body.name || "new_tool",
      description: body.description || "",
      inputSchema: JSON.stringify(body.inputSchema || []),
      handlerType: body.handlerType || "code",
      handlerCode: body.handlerCode || 'return { content: [{ type: "text", text: "Hello from tool!" }] };',
      handlerConfig: JSON.stringify(body.handlerConfig || {}),
    },
  });
  return NextResponse.json(tool, { status: 201 });
}
