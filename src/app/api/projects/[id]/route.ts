import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnonymousId, canAccessProject } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { tools: true, resources: true, prompts: true, envVars: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const anonId = getAnonymousId(req);
  if (!canAccessProject(project.ownerId, anonId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const anonId = getAnonymousId(req);
  if (!canAccessProject(project.ownerId, anonId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.version !== undefined && { version: body.version }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const anonId = getAnonymousId(req);
  if (!canAccessProject(project.ownerId, anonId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
