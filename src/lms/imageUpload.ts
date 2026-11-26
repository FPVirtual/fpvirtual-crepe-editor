// Preparación de una imagen subida desde el editor (docs/imagenes, fase 2).
//
// - PNG, JPEG, GIF y WebP de entrada; SVG nunca (puede llevar JavaScript).
// - Se redimensiona a 1920 px como máximo y se recodifica a JPEG (fotos) o a
//   PNG (si tiene transparencia). Recodificar elimina el EXIF (privacidad:
//   ubicación GPS) y deja formatos que funcionan en todas las exportaciones
//   (el H5P de liaex descarta las WebP). Los GIF se dejan tal cual (animación).
// - Nombre: `img/<slug>-<hash8>.<ext>`, relativo al material, con el hash del
//   contenido: la misma imagen dos veces es el mismo fichero.

import { sha256Hex } from './sha256'

export const MAX_SIDE = 1920
export const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

export class UploadError extends Error {
  constructor(readonly reason: 'type' | 'size' | 'decode') {
    super(reason)
  }
}

export interface PreparedImage {
  /** Ruta relativa al material (la que se escribe en el Markdown). */
  path: string
  blob: Blob
}

/** Parte del nombre del fichero apta para una ruta (ASCII, minúsculas, guiones). */
export function slugify(name: string): string {
  const base = name.replace(/\.[^.]*$/, '')
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug || 'imagen'
}

/** Tamaño de salida: el lado mayor como mucho `max`, sin ampliar. */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * SHA-256 en hexadecimal (8 primeros caracteres). Con crypto.subtle si existe;
 * si no (página servida por http, fuera de un contexto seguro), con la
 * implementación en JavaScript: mismo resultado.
 */
export async function shortHash(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8)
  }
  return sha256Hex(bytes).slice(0, 8)
}

/** Base64 de un blob (para el cuerpo del guardado). */
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UploadError('decode'))), type, quality),
  )
}

/** Redimensiona y recodifica en el navegador (canvas). */
async function recode(file: File): Promise<{ blob: Blob; ext: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UploadError('decode')
  }
  const canPng = file.type === 'image/png' || file.type === 'image/webp'
  // Si sigue siendo demasiado grande, se reduce un 25 % y se vuelve a probar.
  for (let max = MAX_SIDE, attempt = 0; attempt < 4; attempt++, max = Math.round(max * 0.75)) {
    const size = fitSize(bitmap.width, bitmap.height, max)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new UploadError('decode')
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    const alpha = canPng && hasTransparency(ctx.getImageData(0, 0, size.width, size.height).data)
    const blob = alpha ? await encode(canvas, 'image/png') : await encode(canvas, 'image/jpeg', 0.85)
    if (blob.size <= MAX_BYTES) {
      bitmap.close()
      return { blob, ext: alpha ? 'png' : 'jpg' }
    }
  }
  bitmap.close()
  throw new UploadError('size')
}

/** Prepara una imagen elegida por el profesor: ruta y contenido a subir. */
export async function prepareUpload(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.has(file.type)) throw new UploadError('type')
  let blob: Blob
  let ext: string
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new UploadError('size')
    blob = file
    ext = 'gif'
  } else {
    ;({ blob, ext } = await recode(file))
  }
  return { path: `img/${slugify(file.name)}-${await shortHash(blob)}.${ext}`, blob }
}
