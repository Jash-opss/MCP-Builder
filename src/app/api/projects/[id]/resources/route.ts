import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const resources = await prisma.resource.findMany({ where: { projectId: id } });
  return NextResponse.json(resources);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const resource = await prisma.resource.create({
    data: {
      projectId: id,
      uri: body.uri || "resource://example",
      name: body.name || "new_resource",
      description: body.description || "",
      mimeType: body.mimeType || "text/plain",
      handlerCode: body.handlerCode || 'return { contents: [{ uri, text: "Hello from resource!" }] };',
    },
  });
  return NextResponse.json(resource, { status: 201 });
}
