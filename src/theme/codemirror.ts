// Resaltado de sintaxis de los bloques de código (CodeMirror) a partir de los
// tokens `--md-syntax-*`. Sustituye al estilo por defecto de CodeMirror, que
// usa colores fijos ilegibles en el tema oscuro.

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const v = (name: string): string => `var(--md-syntax-${name})`

export const codeHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword], color: v('keyword') },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: v('string') },
    { tag: [t.number, t.bool, t.null, t.atom, t.literal], color: v('number') },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: v('comment'), fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: v('function') },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.variableName)], color: v('type') },
    { tag: [t.tagName, t.attributeName, t.meta, t.processingInstruction, t.heading], color: v('meta') },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.link, textDecoration: 'underline' },
    { tag: t.invalid, color: 'var(--md-color-danger)' },
  ]),
)
