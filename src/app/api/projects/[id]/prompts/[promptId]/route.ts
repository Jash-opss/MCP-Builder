import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectWithAccess } from "@/lib/project-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  const { id, promptId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const prompt = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.arguments !== undefined && {
        arguments: JSON.stringify(body.arguments),
      }),
      ...(body.template !== undefined && { template: body.template }),
    },
  });
  return NextResponse.json(prompt);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  const { id, promptId } = await params;
  const project = await getProjectWithAccess(req, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.prompt.delete({ where: { id: promptId } });
  return NextResponse.json({ success: true });
}
