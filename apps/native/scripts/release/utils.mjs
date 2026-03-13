import fs from "node:fs"
import path from "node:path"
import process from "node:process"

export const repoRoot = path.resolve(import.meta.dirname, "../../../..")
export const nativeDir = path.resolve(repoRoot, "apps/native")
export const srcTauriDir = path.resolve(nativeDir, "src-tauri")
export const baseTauriConfigPath = path.resolve(srcTauriDir, "tauri.conf.json")

export function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index]

    if (!part.startsWith("--")) {
      continue
    }

    const [rawKey, inlineValue] = part.slice(2).split("=", 2)

    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue
      continue
    }

    const nextPart = argv[index + 1]

    if (!nextPart || nextPart.startsWith("--")) {
      args[rawKey] = "true"
      continue
    }

    args[rawKey] = nextPart
    index += 1
  }

  return args
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

export function readTauriConfig() {
  return readJson(baseTauriConfigPath)
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT

  if (!outputPath) {
    for (const [key, value] of Object.entries(values)) {
      console.log(`${key}=${value}`)
    }
    return
  }

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`)
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`)
}

export function deepMerge(target, source) {
  if (Array.isArray(source)) {
    return source.slice()
  }

  if (!isPlainObject(source)) {
    return source
  }

  const output = isPlainObject(target) ? { ...target } : {}

  for (const [key, value] of Object.entries(source)) {
    output[key] = deepMerge(output[key], value)
  }

  return output
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase())
}

export function isSemver(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
}

export function fail(message) {
  console.error(message)
  process.exit(1)
}

export function exists(filePath) {
  return fs.existsSync(filePath)
}
