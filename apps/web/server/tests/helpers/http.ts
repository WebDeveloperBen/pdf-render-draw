export interface TestRequestOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>
}

const testBaseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

function buildUrl(path: string) {
  return new URL(path, testBaseUrl)
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

export async function testFetch<T = unknown>(path: string, options: TestRequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path), options)
  const body = await parseResponseBody(response)

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`) as Error & {
      status: number
      statusCode: number
      data?: unknown
      statusMessage?: string
    }

    error.status = response.status
    error.statusCode = response.status
    error.data = body
    error.statusMessage = response.statusText
    throw error
  }

  return body as T
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
