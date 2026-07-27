import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prompts = await prisma.prompt.findMany({ where: { projectId: id } });
  return NextResponse.json(prompts);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const prompt = await prisma.prompt.create({
    data: {
      projectId: id,
      name: body.name || "new_prompt",
      description: body.description || "",
      arguments: JSON.stringify(body.arguments || []),
      template: body.template || "Hello {{name}}, how can I help you?",
    },
  });
  return NextResponse.json(prompt, { status: 201 });
}
