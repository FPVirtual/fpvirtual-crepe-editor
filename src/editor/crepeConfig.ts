// Configuración de las funciones de Crepe: textos en español (la interfaz
// por defecto está en inglés) y grupo «LiaScript» en el menú «/».

import { Crepe, type CrepeConfig } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'

import { t } from '../i18n'
import { cardViewAt, LIA_BLOCK, LIA_TEMPLATES, macroSource, type HeaderMacro } from '../liascript'
import { codeHighlight } from '../theme/codemirror'

/** Icono del grupo LiaScript (SVG en línea, color heredado). */
const LIA_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6 3 12l5 6M16 6l5 6-5 6M13.5 4l-3 16"/></svg>'

/**
 * Inserta Markdown LiaScript en lugar del bloque actual (el del «/») y, si
 * resulta una tarjeta, la abre en edición.
 */
export function insertLiaSource(ctx: Ctx, source: string): void {
  ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key)
  const view = ctx.get(editorViewCtx)
  const { state } = view
  const { $from } = state.selection
  const depth = $from.depth
  const from = $from.before(depth)
  const to = $from.after(depth)
  const content = ctx.get(parserCtx)(source).content
  const replaceCurrent = $from.parent.content.size === 0
  const tr = replaceCurrent ? state.tr.replaceWith(from, to, content) : state.tr.insert(to, content)
  view.dispatch(tr.scrollIntoView())
  const at = replaceCurrent ? from : to
  if (content.firstChild?.type.name === LIA_BLOCK) cardViewAt(view, at)?.startEdit()
}

/** Ganchos de imágenes del editor (docs/imagenes). */
export interface ImageHooks {
  /** URL que se pinta para la del Markdown (rutas relativas → `blob:`). */
  display: (url: string) => string | Promise<string>
  /** Subida: devuelve la ruta relativa que se escribe en el Markdown. */
  upload?: (file: File) => Promise<string>
  /** Empieza una subida (botón, pegar o soltar): borra los avisos anteriores. */
  beginUpload?: () => void
}

export function crepeFeatureConfigs(
  macros: HeaderMacro[] = [],
  images?: ImageHooks,
): NonNullable<CrepeConfig['featureConfigs']> {
  return {
    [Crepe.Feature.CodeMirror]: {
      theme: codeHighlight,
      searchPlaceholder: t('crepe.code.search'),
      noResultText: t('crepe.code.noResult'),
      copyText: t('crepe.code.copy'),
      previewToggleText: (previewOnly: boolean) => (previewOnly ? t('crepe.code.edit') : t('crepe.code.hide')),
    },
    [Crepe.Feature.Placeholder]: {
      text: t('crepe.placeholder'),
    },
    [Crepe.Feature.Toolbar]: {
      boldLabel: t('crepe.toolbar.bold'),
      italicLabel: t('crepe.toolbar.italic'),
      strikethroughLabel: t('crepe.toolbar.strike'),
      codeLabel: t('crepe.toolbar.code'),
      linkLabel: t('crepe.toolbar.link'),
      latexLabel: t('crepe.toolbar.latex'),
    },
    [Crepe.Feature.LinkTooltip]: {
      inputPlaceholder: t('crepe.link.placeholder'),
    },
    [Crepe.Feature.ImageBlock]: {
      inlineUploadButton: t('crepe.image.upload'),
      inlineUploadPlaceholderText: t('crepe.image.urlPlaceholder'),
      blockUploadButton: t('crepe.image.upload'),
      blockUploadPlaceholderText: t('crepe.image.urlPlaceholder'),
      blockCaptionPlaceholderText: t('crepe.image.caption'),
      ...(images ? { proxyDomURL: images.display } : {}),
      // Sin subida propia, Crepe guardaría una URL blob: que se pierde al cerrar.
      onUpload: images?.upload
        ? (file: File) => {
            images.beginUpload?.()
            return images.upload!(file)
          }
        : () => Promise.reject(new Error('subida no disponible')),
    },
    [Crepe.Feature.BlockEdit]: {
      textGroup: {
        label: t('crepe.menu.text'),
        text: { label: t('crepe.menu.paragraph') },
        h1: { label: t('crepe.menu.h', { n: 1 }) },
        h2: { label: t('crepe.menu.h', { n: 2 }) },
        h3: { label: t('crepe.menu.h', { n: 3 }) },
        h4: { label: t('crepe.menu.h', { n: 4 }) },
        h5: { label: t('crepe.menu.h', { n: 5 }) },
        h6: { label: t('crepe.menu.h', { n: 6 }) },
        quote: { label: t('crepe.menu.quote') },
        divider: { label: t('crepe.menu.divider') },
      },
      listGroup: {
        label: t('crepe.menu.lists'),
        bulletList: { label: t('crepe.menu.bullet') },
        orderedList: { label: t('crepe.menu.ordered') },
        taskList: { label: t('crepe.menu.task') },
      },
      advancedGroup: {
        label: t('crepe.menu.advanced'),
        image: { label: t('crepe.menu.image') },
        codeBlock: { label: t('crepe.menu.code') },
        table: { label: t('crepe.menu.table') },
        math: { label: t('crepe.menu.math') },
      },
      buildMenu: (builder) => {
        const group = builder.addGroup('liascript', t('crepe.menu.liascript'))
        for (const template of LIA_TEMPLATES) {
          group.addItem(`lia-${template.key}`, {
            label: template.label,
            icon: LIA_ICON,
            onRun: (ctx) => insertLiaSource(ctx, template.source),
          })
        }
        for (const macro of macros) {
          group.addItem(`lia-macro-${macro.name}`, {
            label: t('lia.template.macro', { name: macro.name }),
            icon: LIA_ICON,
            onRun: (ctx) => insertLiaSource(ctx, macroSource(macro)),
          })
        }
      },
    },
  }
}
