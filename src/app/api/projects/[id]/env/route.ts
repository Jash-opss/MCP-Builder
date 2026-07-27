import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const envVars = await prisma.envVariable.findMany({ where: { projectId: id } });
  return NextResponse.json(envVars);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const envVar = await prisma.envVariable.create({
    data: {
      projectId: id,
      key: body.key || "NEW_VAR",
      value: body.value || "",
      description: body.description || "",
    },
  });
  return NextResponse.json(envVar, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const project = await getProjectWithAccess(req, projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const envVar = await prisma.envVariable.update({
    where: { id: body.id },
    data: {
      ...(body.key !== undefined && { key: body.key }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });
  return NextResponse.json(envVar);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const project = await getProjectWithAccess(req, projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const envId = searchParams.get("envId");
  if (!envId) return NextResponse.json({ error: "envId required" }, { status: 400 });
  await prisma.envVariable.delete({ where: { id: envId } });
  return NextResponse.json({ success: true });
}
