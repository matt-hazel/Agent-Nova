import "dotenv/config";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../lib/projects";
import { prisma } from "../lib/db";

function printProject(p: {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  updatedAt: Date;
}) {
  console.log(
    `${p.id}  [${p.status}]  ${p.name}${p.notes ? `  — ${p.notes}` : ""}`
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "list": {
      const projects = await listProjects();
      if (projects.length === 0) {
        console.log("No projects yet.");
      } else {
        projects.forEach(printProject);
      }
      break;
    }
    case "add": {
      const [name, status, notes] = args;
      if (!name) {
        console.error('Usage: projects add "<name>" [status] [notes]');
        process.exitCode = 1;
        break;
      }
      const project = await createProject({ name, status, notes });
      printProject(project);
      break;
    }
    case "update": {
      const [id, field, value] = args;
      if (!id || !field || value === undefined) {
        console.error('Usage: projects update <id> <name|status|notes> "<value>"');
        process.exitCode = 1;
        break;
      }
      if (field !== "name" && field !== "status" && field !== "notes") {
        console.error("field must be one of: name, status, notes");
        process.exitCode = 1;
        break;
      }
      const project = await updateProject(id, { [field]: value });
      printProject(project);
      break;
    }
    case "delete": {
      const [id] = args;
      if (!id) {
        console.error("Usage: projects delete <id>");
        process.exitCode = 1;
        break;
      }
      await deleteProject(id);
      console.log(`Deleted ${id}`);
      break;
    }
    default: {
      console.log(
        [
          "Usage:",
          '  projects list',
          '  projects add "<name>" [status] [notes]',
          '  projects update <id> <name|status|notes> "<value>"',
          "  projects delete <id>",
        ].join("\n")
      );
      process.exitCode = command ? 1 : 0;
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
