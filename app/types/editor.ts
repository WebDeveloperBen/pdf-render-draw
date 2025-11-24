/**
 * V2 Editor Types
 */

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Base shape interface for V2 editor
 * This is temporary for migration - will map to actual annotation types
 */
export interface Shape {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fill?: string
}

/**
 * Scale handle positions
 */
export type ScaleHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"
