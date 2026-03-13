import path from "node:path"
import process from "node:process"

import {
  deepMerge,
  fail,
  parseArgs,
  readJson,
  readTauriConfig,
  repoRoot,
  srcTauriDir,
  writeJson,
} from "./utils.mjs"

const args = parseArgs(process.argv.slice(2))
const platform = args.platform
const output = args.output
const version = args.version
const androidVersionCode = args["android-version-code"]

if (!platform) {
  fail("Missing required argument --platform.")
}

if (!output) {
  fail("Missing required argument --output.")
}

let config = readTauriConfig()
const overlayPath = path.resolve(repoRoot, `apps/native/release/tauri.${platform}.json`)

try {
  const overlay = readJson(overlayPath)
  config = deepMerge(config, overlay)
}
catch (error) {
  fail(`Unable to read release overlay ${overlayPath}: ${error.message}`)
}

if (version) {
  config.version = version
}

if (platform === "apple" && process.env.APPLE_TEAM_ID) {
  config.bundle ??= {}
  config.bundle.iOS ??= {}
  config.bundle.iOS.developmentTeam = process.env.APPLE_TEAM_ID
}

if (platform === "android" && androidVersionCode) {
  config.bundle ??= {}
  config.bundle.android ??= {}
  config.bundle.android.versionCode = Number(androidVersionCode)
}

const outputPath = path.isAbsolute(output)
  ? output
  : path.resolve(srcTauriDir, output)
writeJson(outputPath, config)

console.log(outputPath)
