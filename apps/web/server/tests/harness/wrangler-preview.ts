import { spawn, type ChildProcess } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface PreviewServerOptions {
  baseUrl: string
  cwd: string
}

interface RunningPreviewServer {
  stop: () => Promise<void>
}

interface CommandResult {
  logs: string
}

function appendLog(buffer: string[], chunk: Buffer | string) {
  buffer.push(chunk.toString())
  if (buffer.length > 200) {
    buffer.shift()
  }
}

function formatLogs(buffer: string[]) {
  const logs = buffer.join("").trim()
  return logs ? `\n\nRecent preview logs:\n${logs}` : ""
}

async function createWranglerEnvFile() {
  const tempDir = await mkdtemp(join(tmpdir(), "pdf-annotator-prod-smoke-"))
  const envFilePath = join(tempDir, ".env")
  const relevantKeys = [
    "VITEST",
    "DATABASE_URL",
    "NUXT_DATABASE_URL",
    "__TEST_DATABASE_URL__",
    "BETTER_AUTH_SECRET",
    "NUXT_BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "NUXT_BETTER_AUTH_URL",
    "NUXT_PUBLIC_BETTER_AUTH_URL",
    "NUXT_STRIPE_SECRET_KEY",
    "NUXT_STRIPE_WEBHOOK_SECRET",
    "NUXT_RESEND_API_KEY",
    "HOST",
    "PORT"
  ]

  const contents = relevantKeys
    .map((key) => {
      const value = process.env[key]
      return value === undefined ? null : `${key}=${JSON.stringify(value)}`
    })
    .filter((line): line is string => line !== null)
    .join("\n")

  await writeFile(envFilePath, `${contents}\n`, "utf8")

  return {
    envFilePath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

async function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const logs: string[] = []
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    })

    child.stdout.on("data", (chunk) => appendLog(logs, chunk))
    child.stderr.on("data", (chunk) => appendLog(logs, chunk))
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ logs: logs.join("") })
        return
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")} (exit ${code})${formatLogs(logs)}`))
    })
  })
}

async function waitForHealthyServer(baseUrl: string, child: ChildProcess, logs: string[]) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler preview exited early with code ${child.exitCode}${formatLogs(logs)}`)
    }

    try {
      const response = await fetch(new URL("/api/health", baseUrl))
      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Timed out waiting for Wrangler preview at ${baseUrl}${formatLogs(logs)}`)
}

export async function buildCloudflareBundle(cwd: string) {
  console.log("\n🏗️ Building Cloudflare bundle for prod smoke...")
  await runCommand("pnpm", ["exec", "nuxt", "build"], cwd)
  console.log("✅ Cloudflare bundle built")
}

export async function startWranglerPreview({ baseUrl, cwd }: PreviewServerOptions): Promise<RunningPreviewServer> {
  console.log("\n☁️ Starting Wrangler preview...")

  const url = new URL(baseUrl)
  const logs: string[] = []
  const envFile = await createWranglerEnvFile()
  const child = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      ".output/server/index.mjs",
      "--assets",
      ".output/public",
      "--local",
      "--ip",
      url.hostname,
      "--port",
      url.port || "80",
      "--local-protocol",
      url.protocol.replace(":", ""),
      "--env-file",
      envFile.envFilePath,
      "--log-level",
      "error",
      "--show-interactive-dev-session=false"
    ],
    {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  )

  child.stdout.on("data", (chunk) => appendLog(logs, chunk))
  child.stderr.on("data", (chunk) => appendLog(logs, chunk))

  await waitForHealthyServer(baseUrl, child, logs)
  console.log("✅ Wrangler preview ready")

  return {
    async stop() {
      if (child.exitCode !== null || child.killed) {
        await envFile.cleanup()
        return
      }

      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve())
        child.kill("SIGTERM")

        setTimeout(() => {
          if (child.exitCode === null && !child.killed) {
            child.kill("SIGKILL")
          }
        }, 10_000)
      })

      await envFile.cleanup()
    }
  }
}
