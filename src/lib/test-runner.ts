import { ChildProcess, spawn } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import os from "os";
import {
  generateServerCode,
  generatePackageJson,
  generateTsConfig,
} from "./codegen";
import type { McpProject } from "@/types/mcp";

const activeServers = new Map<string, { process: ChildProcess; port: number; dir: string }>();

function getAvailablePort(): number {
  return 3100 + Math.floor(Math.random() * 900);
}

export async function startTestServer(project: McpProject): Promise<{ port: number; pid: number }> {
  if (activeServers.has(project.id)) {
    const existing = activeServers.get(project.id)!;
    return { port: existing.port, pid: existing.process.pid! };
  }

  const port = getAvailablePort();
  const tmpDir = path.join(os.tmpdir(), `mcp-test-${project.id}-${Date.now()}`);

  mkdirSync(path.join(tmpDir, "src"), { recursive: true });

  const code = generateServerCode(project, "http");
  const pkgJson = generatePackageJson(project, "http");
  const tsConfig = generateTsConfig();

  writeFileSync(path.join(tmpDir, "src", "index.ts"), code);
  writeFileSync(path.join(tmpDir, "package.json"), pkgJson);
  writeFileSync(path.join(tmpDir, "tsconfig.json"), tsConfig);

  const npmPath = process.platform === "win32" ? "npm.cmd" : "npm";
  const installProc = spawn(npmPath, ["install", "--no-audit", "--no-fund"], {
    cwd: tmpDir,
    stdio: "pipe",
  });

  await new Promise<void>((resolve, reject) => {
    installProc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed with code ${code}`));
    });
    installProc.on("error", reject);
  });

  const npxPath = process.platform === "win32" ? "npx.cmd" : "npx";
  const serverProc = spawn(npxPath, ["tsx", "src/index.ts"], {
    cwd: tmpDir,
    stdio: "pipe",
    env: {
      ...process.env,
      PORT: String(port),
      ...(project.envVars || []).reduce(
        (acc, v) => ({ ...acc, [v.key]: v.value }),
        {} as Record<string, string>
      ),
    },
  });

  serverProc.stdout?.on("data", (data) => {
    console.log(`[test-server:${project.id}] ${data}`);
  });
  serverProc.stderr?.on("data", (data) => {
    console.error(`[test-server:${project.id}] ${data}`);
  });

  activeServers.set(project.id, { process: serverProc, port, dir: tmpDir });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  return { port, pid: serverProc.pid! };
}

export function stopTestServer(projectId: string): boolean {
  const server = activeServers.get(projectId);
  if (!server) return false;

  server.process.kill("SIGTERM");
  activeServers.delete(projectId);

  try {
    const { rmSync } = require("fs");
    if (existsSync(server.dir)) {
      rmSync(server.dir, { recursive: true, force: true });
    }
  } catch {
    // cleanup is best-effort
  }

  return true;
}

export function getTestServerStatus(projectId: string): { running: boolean; port?: number } {
  const server = activeServers.get(projectId);
  if (!server) return { running: false };
  return { running: !server.process.killed, port: server.port };
}
