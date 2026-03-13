import { describe, expect, it } from "vitest"
import { hashSharePassword, sanitiseProjectSharesForProjectResponse } from "#shared/utils/project-share"
import { buildConflictServerVersion, isAnnotationScopedToFile } from "#shared/utils/annotation-sync"

describe("project share security helpers", () => {
  it("hashes updated share passwords with the same digest used for access checks", () => {
    expect(hashSharePassword("secret-pass")).toBe("f38eb016088980f10dcbffce49bc7d0d476d198c43a6fa8a343416709049c9db")
    expect(hashSharePassword(null)).toBeNull()
  })

  it("removes share tokens and stored passwords from project detail payloads", () => {
    const [share] = sanitiseProjectSharesForProjectResponse([
      {
        id: "share-1",
        projectId: "project-1",
        createdBy: "user-1",
        name: "External share",
        shareType: "public",
        message: "hello",
        expiresAt: null,
        allowDownload: true,
        allowNotes: false,
        viewCount: 4,
        lastViewedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        token: "live-token",
        password: "hashed-secret"
      }
    ] as never)

    expect(share).not.toHaveProperty("token")
    expect(share).not.toHaveProperty("password")
    expect(share).toMatchObject({
      id: "share-1",
      projectId: "project-1"
    })
  })
})

describe("annotation sync helpers", () => {
  it("keeps conflict payloads renderable on the client", () => {
    expect(
      buildConflictServerVersion({
        id: "annotation-1",
        fileId: "file-1",
        type: "measure",
        pageNum: 2,
        version: 7,
        deletedAt: new Date("2026-03-13T00:00:00.000Z"),
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 }
          ],
          distance: 100,
          midpoint: { x: 50, y: 0 },
          labelRotation: 0,
          rotation: 0
        }
      })
    ).toMatchObject({
      id: "annotation-1",
      type: "measure",
      pageNum: 2,
      version: 7,
      deletedAt: "2026-03-13T00:00:00.000Z"
    })
  })

  it("rejects annotations that do not belong to the active file scope", () => {
    expect(isAnnotationScopedToFile({ fileId: "file-1" }, "file-1")).toBe(true)
    expect(isAnnotationScopedToFile({ fileId: "file-2" }, "file-1")).toBe(false)
  })
})
