export interface ScopedAnnotationRecord {
  id: string
  fileId: string
  type: string
  pageNum: number
  version: number
  deletedAt: Date | null
  data: Record<string, unknown>
}

export function isAnnotationScopedToFile(annotation: Pick<ScopedAnnotationRecord, "fileId">, fileId: string) {
  return annotation.fileId === fileId
}

export function buildConflictServerVersion(annotation: ScopedAnnotationRecord) {
  return {
    ...annotation.data,
    id: annotation.id,
    type: annotation.type,
    pageNum: annotation.pageNum,
    version: annotation.version,
    deletedAt: annotation.deletedAt?.toISOString() ?? null
  }
}
