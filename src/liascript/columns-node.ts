// Nodos de columnas en el editor: `lia_columns` > `lia_column` (bloques
// editables). Formato en Markdown: columns.ts.

import { $node } from '@milkdown/kit/utils'

import { t } from '../i18n'
import { COLUMN_OPEN, COLUMNS_OPEN, MAX_COLUMNS, MIN_COLUMNS, type ColumnMdast } from './columns'

export const LIA_COLUMNS = 'lia_columns'
export const LIA_COLUMN = 'lia_column'

export const liaColumnNode = $node(LIA_COLUMN, () => ({
  content: 'block+',
  isolating: true,
  defining: true,
  parseDOM: [{ tag: 'div[data-lia-column]' }],
  toDOM: () => ['div', { 'data-lia-column': '', class: 'lia-column' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'liaColumn',
    runner: (state, node, type) => {
      state.openNode(type)
      state.next((node as unknown as ColumnMdast).children as never)
      state.closeNode()
    },
  },
  // Se serializa desde lia_columns (las marcas van entre columnas).
  toMarkdown: {
    match: (node) => node.type.name === LIA_COLUMN,
    runner: (state, node) => {
      state.next(node.content)
    },
  },
}))

export const liaColumnsNode = $node(LIA_COLUMNS, () => ({
  group: 'block',
  content: `${LIA_COLUMN}{${MIN_COLUMNS},${MAX_COLUMNS}}`,
  isolating: true,
  selectable: true,
  draggable: true,
  parseDOM: [{ tag: 'div[data-lia-columns]' }],
  toDOM: (node) => [
    'div',
    {
      'data-lia-columns': '',
      class: `lia-columns lia-columns--${node.childCount}`,
      role: 'group',
      'aria-label': t('columns.label', { n: node.childCount }),
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'liaColumns',
    runner: (state, node, type) => {
      state.openNode(type)
      state.next((node as unknown as { children: unknown[] }).children as never)
      state.closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === LIA_COLUMNS,
    runner: (state, node) => {
      // Marcas HTML como bloques hermanos del contenido: remark-stringify los
      // separa con una línea en blanco, que es lo que LiaScript necesita.
      node.forEach((column, _offset, index) => {
        state.addNode('html', undefined, index === 0 ? `${COLUMNS_OPEN}\n${COLUMN_OPEN}` : `</div>\n${COLUMN_OPEN}`)
        state.next(column.content)
      })
      state.addNode('html', undefined, '</div>\n</div>')
    },
  },
}))
