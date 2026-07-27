import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id, resourceId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const resource = await prisma.resource.update({
    where: { id: resourceId },
    data: {
      ...(body.uri !== undefined && { uri: body.uri }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.mimeType !== undefined && { mimeType: body.mimeType }),
      ...(body.handlerCode !== undefined && { handlerCode: body.handlerCode }),
    },
  });
  return NextResponse.json(resource);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id, resourceId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.resource.delete({ where: { id: resourceId } });
  return NextResponse.json({ success: true });
}
