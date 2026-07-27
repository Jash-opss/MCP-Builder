import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnonymousIdOrEmpty, canAccessProject, getAnonymousId } from "@/lib/auth";

export async function GET(req: Request) {
  const ownerId = getAnonymousIdOrEmpty(req);
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ ownerId: "" }, { ownerId }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tools: true, resources: true, prompts: true } },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const ownerId = getAnonymousIdOrEmpty(req);
  const body = await req.json();
  const project = await prisma.project.create({
    data: {
      ownerId,
      name: body.name || "Untitled MCP Server",
      description: body.description || "",
      version: body.version || "1.0.0",
    },
  });
  return NextResponse.json(project, { status: 201 });
}
