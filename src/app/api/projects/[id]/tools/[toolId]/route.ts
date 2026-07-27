import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const tool = await prisma.tool.update({
    where: { id: toolId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.inputSchema !== undefined && {
        inputSchema: JSON.stringify(body.inputSchema),
      }),
      ...(body.handlerType !== undefined && { handlerType: body.handlerType }),
      ...(body.handlerCode !== undefined && { handlerCode: body.handlerCode }),
      ...(body.handlerConfig !== undefined && {
        handlerConfig: JSON.stringify(body.handlerConfig),
      }),
    },
  });
  return NextResponse.json(tool);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.tool.delete({ where: { id: toolId } });
  return NextResponse.json({ success: true });
}
