// Bloque de imagen de Crepe compatible con LiaScript (docs/imagenes).
//
// Crepe guarda en el Markdown del bloque de imagen la proporción en el texto
// alternativo (`![1.00](img.png)`) y el pie en el título. Eso destruye el
// texto alternativo del material (accesibilidad) en cuanto se guarda. Aquí
// se redefine la correspondencia:
//
//   ![texto alternativo](ruta "título")  ⇄  bloque {src, caption = alt, title}
//
// El pie que se edita bajo la imagen ES el texto alternativo; el título se
// conserva tal cual y la proporción (tamaño en pantalla) no se escribe en el
// Markdown.

import { imageBlockSchema } from '@milkdown/kit/component/image-block'

export const liaImageBlockSchema = imageBlockSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx)
  return {
    ...base,
    attrs: { ...base.attrs, title: { default: '', validate: 'string' } },
    parseMarkdown: {
      match: ({ type }) => type === 'image-block',
      runner: (state, node, type) => {
        state.addNode(type, {
          src: String(node.url ?? ''),
          caption: String(node.alt ?? ''),
          title: String(node.title ?? ''),
          ratio: 1,
        })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'image-block',
      runner: (state, node) => {
        state.openNode('paragraph')
        state.addNode('image', undefined, undefined, {
          url: node.attrs.src,
          alt: node.attrs.caption,
          title: node.attrs.title || null,
        })
        state.closeNode()
      },
    },
  }
})
