import type { PageViewport } from "pdfjs-dist"
import type {
  DocumentInitParameters,
  OnProgressParameters,
  PDFDataRangeTransport,
  TypedArray,
} from "pdfjs-dist/types/src/display/api"
import type { Metadata } from "pdfjs-dist/types/src/display/metadata"

export type LoadedEventPayload = PageViewport

export interface AnnotationEventPayload {
  type: string
  data: unknown
}

export interface WatermarkOptions {
  columns?: number
  rows?: number
  rotation?: number
  fontSize?: number
  color?: string
}

export type OnProgressCallback = (progressData: OnProgressParameters) => void
export type UpdatePasswordFn = (newPassword: string) => void
export type OnPasswordCallback = (updatePassword: UpdatePasswordFn, reason: unknown) => void
export type OnErrorCallback = (error: unknown) => void

export type UsePDFSrc =
  | string
  | URL
  | TypedArray
  | PDFDataRangeTransport
  | DocumentInitParameters
  | undefined
  | null

export interface UsePDFOptions {
  onProgress?: OnProgressCallback
  onPassword?: OnPasswordCallback
  onError?: OnErrorCallback
  password?: string
}

export interface UsePDFInfoMetadata {
  info: object
  metadata: Metadata
}

export interface UsePDFInfo {
  metadata: UsePDFInfoMetadata
  attachments: Record<string, unknown>
  javascript: string[] | null
}

export interface PopupArgs {
  [key: string]: string
}

export interface LinkAnnotation {
  dest: unknown[] | string
  url: string
  unsafeurl: string
}
