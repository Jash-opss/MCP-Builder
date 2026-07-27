import { prisma } from "@/lib/db";
import { getAnonymousId, canAccessProject } from "@/lib/auth";

/** Returns the project if it exists and the request has access (by anonymous id); otherwise null. */
export async function getProjectWithAccess(request: Request, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (!canAccessProject(project.ownerId, getAnonymousId(request))) return null;
  return project;
}
