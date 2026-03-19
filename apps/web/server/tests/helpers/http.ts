import { url as testUtilsUrl } from "@nuxt/test-utils/e2e"

type JsonBody = Record<string, unknown> | Array<unknown>

export interface TestRequestOptions extends Omit<RequestInit, "headers" | "body"> {
  headers?: Record<string, string>
  body?: BodyInit | JsonBody | null
}

function resolveBaseUrl() {
  try {
    return testUtilsUrl("/")
  } catch {
    return process.env.BETTER_AUTH_URL || "http://localhost:3000"
  }
}

export const testBaseUrl = resolveBaseUrl()

export function buildUrl(path: string) {
  return new URL(path, resolveBaseUrl())
}

export async function waitForTestServer(options: { attempts?: number; delayMs?: number } = {}) {
  const attempts = options.attempts ?? 60
  const delayMs = options.delayMs ?? 500

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(buildUrl("/api/health"))
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the Nuxt dev server is accepting connections.
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Timed out waiting for test server at ${resolveBaseUrl()}`)
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return await response.json()
  }

  return await response.text()
}

function shouldRetryRequest(error: unknown) {
  if (!(error instanceof TypeError)) {
    return false
  }

  const cause = (error as TypeError & { cause?: { code?: string } }).cause
  return cause?.code === "ECONNREFUSED"
}

function isJsonBody(body: TestRequestOptions["body"]): body is JsonBody {
  if (!body || typeof body !== "object") {
    return false
  }

  return !(body instanceof ReadableStream || body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData || body instanceof URLSearchParams)
    && !ArrayBuffer.isView(body)
}

export async function testFetch<T = unknown>(path: string, options: TestRequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const requestOptions: RequestInit = {
    ...rest,
    headers: { ...(headers ?? {}) }
  }

  if (isJsonBody(body)) {
    requestOptions.body = JSON.stringify(body)
    if (!requestOptions.headers || !("content-type" in requestOptions.headers)) {
      requestOptions.headers = {
        ...(requestOptions.headers as Record<string, string>),
        "content-type": "application/json"
      }
    }
  } else {
    requestOptions.body = body ?? undefined
  }

  let response: Response | undefined

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      response = await fetch(buildUrl(path), requestOptions)
      break
    } catch (error) {
      if (!shouldRetryRequest(error) || attempt === 4) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  if (!response) {
    throw new Error(`No response returned for ${path}`)
  }

  const responseBody = await parseResponseBody(response)

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}: ${JSON.stringify(responseBody)}`) as Error & {
      status: number
      statusCode: number
      data?: unknown
      statusMessage?: string
    }

    error.status = response.status
    error.statusCode = response.status
    error.data = responseBody
    error.statusMessage = response.statusText
    throw error
  }

  return responseBody as T
}

export async function expectHttpError(
  path: string,
  expectedStatus: number,
  options: TestRequestOptions = {}
): Promise<{ statusCode: number; statusMessage: string; data?: unknown }> {
  try {
    await testFetch(path, options)
    throw new Error(`Expected ${expectedStatus} error but request succeeded`)
  } catch (error: unknown) {
    const fetchError = error as { status?: number; statusCode?: number; data?: unknown; statusMessage?: string }
    const status = fetchError.status ?? fetchError.statusCode

    if (status !== expectedStatus) {
      throw new Error(`Expected ${expectedStatus} but got ${status}: ${JSON.stringify(fetchError.data)}`)
    }

    return {
      statusCode: expectedStatus,
      statusMessage: fetchError.statusMessage ?? "",
      data: fetchError.data
    }
  }
}
