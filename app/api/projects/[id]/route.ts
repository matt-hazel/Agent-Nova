import { NextResponse } from "next/server";
import { deleteProject, updateProject } from "../../../../lib/projects";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const project = await updateProject(id, {
    name: body.name,
    status: body.status,
    notes: body.notes,
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteProject(id);
  return new NextResponse(null, { status: 204 });
}
