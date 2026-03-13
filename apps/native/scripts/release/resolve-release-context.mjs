import process from "node:process"

import { isSemver, parseArgs, toBoolean, writeGithubOutput } from "./utils.mjs"

const args = parseArgs(process.argv.slice(2))

const githubRefName = process.env.GITHUB_REF_NAME ?? ""
const inputVersion = args.version ?? process.env.INPUT_VERSION ?? ""
const inputChannel = args["release-channel"] ?? process.env.INPUT_RELEASE_CHANNEL ?? ""
const inputPublish = args.publish ?? process.env.INPUT_PUBLISH
const inputDryRun = args["dry-run"] ?? process.env.INPUT_DRY_RUN

const version = resolveVersion(inputVersion, githubRefName)
const releaseChannel = inputChannel || "production"
const publish = toBoolean(inputPublish, true)
const dryRun = toBoolean(inputDryRun, false)
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? "1"

writeGithubOutput({
  version,
  release_channel: releaseChannel,
  publish: String(publish),
  dry_run: String(dryRun),
  build_number: String(buildNumber),
  android_version_code: String(buildNumber),
})

function resolveVersion(explicitVersion, refName) {
  if (explicitVersion) {
    if (!isSemver(explicitVersion)) {
      throw new Error(`Invalid version "${explicitVersion}". Expected semantic versioning like 1.2.3.`)
    }

    return explicitVersion
  }

  if (refName.startsWith("native-v")) {
    const tagVersion = refName.slice("native-v".length)

    if (!isSemver(tagVersion)) {
      throw new Error(`Tag "${refName}" does not contain a valid semantic version.`)
    }

    return tagVersion
  }

  throw new Error("Unable to resolve a release version. Provide a workflow input or use a native-vX.Y.Z tag.")
}
