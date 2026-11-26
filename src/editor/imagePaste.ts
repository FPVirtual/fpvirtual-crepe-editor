// Pegar y arrastrar imágenes (roadmap docs/imagenes del plugin, fase 3).
//
// Crepe ya engancha el plugin de subida de Milkdown (pegar y soltar ficheros)
// a `onUpload`, pero con dos fallos para nosotros:
// - si una imagen falla (SVG, demasiado grande, sin subida disponible) la
//   promesa se rechaza y el aviso «Upload in progress...» se queda para
//   siempre en el documento;
// - una imagen que falla tira las demás del mismo pegado.
// Este uploader sube una a una, salta las que fallan (el aviso lo muestra
// quien sube) y nunca rechaza: el marcador siempre se retira.

import type { Node } from '@milkdown/kit/prose/model'
import { Decoration } from '@milkdown/kit/prose/view'
import type { Uploader } from '@milkdown/kit/plugin/upload'
import { t } from '../i18n'

export type UploadImage = (file: File) => Promise<string>

/** Uploader para el plugin de subida: bloques de imagen con la ruta subida. */
export function imageUploader(upload?: UploadImage, beginUpload?: () => void): Uploader {
  return async (files, schema) => {
    const type = schema.nodes['image-block'] ?? schema.nodes.image
    if (!type || !upload) return []
    beginUpload?.()
    const nodes: Node[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const node = type.createAndFill({ src: await upload(file) })
        if (node) nodes.push(node)
      } catch {
        // Imagen no admitida: `upload` ya ha avisado; se siguen las demás.
      }
    }
    return nodes
  }
}

/** Marcador mientras se prepara la imagen (en lugar de «Upload in progress...»). */
export function uploadWidget(pos: number, spec: Parameters<typeof Decoration.widget>[2]): Decoration {
  const dom = document.createElement('span')
  dom.className = 'lia-uploading'
  dom.textContent = t('image.uploading')
  return Decoration.widget(pos, dom, spec)
}
