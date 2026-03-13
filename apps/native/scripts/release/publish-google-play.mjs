import crypto from "node:crypto"
import fs from "node:fs"
import process from "node:process"

import { fail, parseArgs } from "./utils.mjs"

const args = parseArgs(process.argv.slice(2))

const bundlePath = args.bundle
const packageName = args["package-name"] ?? process.env.ANDROID_PACKAGE_NAME
const track = args.track ?? "production"
const releaseName = args["release-name"] ?? process.env.RELEASE_NAME ?? "Automated release"
const releaseNotesPath = args["release-notes"]
const status = args.status ?? "completed"

if (!bundlePath) {
  fail("Missing required argument --bundle.")
}

if (!packageName) {
  fail("Missing Android package name. Pass --package-name or set ANDROID_PACKAGE_NAME.")
}

const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON

if (!serviceAccountJson) {
  fail("Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.")
}

const serviceAccount = JSON.parse(serviceAccountJson)
const accessToken = await getAccessToken(serviceAccount)
const edit = await createEdit(accessToken, packageName)
const bundle = await uploadBundle(accessToken, packageName, edit.id, bundlePath)
const versionCode = String(bundle.versionCode)

await updateTrack(accessToken, packageName, edit.id, track, versionCode, releaseName, readReleaseNotes(releaseNotesPath), status)
await commitEdit(accessToken, packageName, edit.id)

console.log(`Google Play release committed: package=${packageName} track=${track} versionCode=${versionCode}`)

function readReleaseNotes(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [{ language: "en-AU", text: releaseName }]
  }

  return [
    {
      language: "en-AU",
      text: fs.readFileSync(filePath, "utf8").trim(),
    },
  ]
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  }

  const encodedHeader = encodeSegment(header)
  const encodedClaims = encodeSegment(claims)
  const unsignedToken = `${encodedHeader}.${encodedClaims}`
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedToken), {
    key: serviceAccount.private_key,
  }).toString("base64url")

  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
  })

  if (!response.ok) {
    fail(`Google OAuth token request failed: ${await response.text()}`)
  }

  const payload = await response.json()
  return payload.access_token
}

async function createEdit(accessToken, packageName) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    fail(`Unable to create Google Play edit: ${await response.text()}`)
  }

  return response.json()
}

async function uploadBundle(accessToken, packageName, editId, bundlePath) {
  const response = await fetch(`https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles?uploadType=media`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/octet-stream",
    },
    body: fs.readFileSync(bundlePath),
  })

  if (!response.ok) {
    fail(`Unable to upload Android App Bundle: ${await response.text()}`)
  }

  return response.json()
}

async function updateTrack(accessToken, packageName, editId, track, versionCode, releaseName, releaseNotes, status) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/tracks/${track}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      track,
      releases: [
        {
          name: releaseName,
          status,
          versionCodes: [versionCode],
          releaseNotes,
        },
      ],
    }),
  })

  if (!response.ok) {
    fail(`Unable to update Google Play track ${track}: ${await response.text()}`)
  }
}

async function commitEdit(accessToken, packageName, editId) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}:commit`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    fail(`Unable to commit Google Play edit ${editId}: ${await response.text()}`)
  }
}

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}
