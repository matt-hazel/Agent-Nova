import { NextResponse } from "next/server";
import { createProject, listProjects } from "../../../lib/projects";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const project = await createProject({
    name: body.name,
    status: body.status,
    notes: body.notes,
  });
  return NextResponse.json(project, { status: 201 });
}
