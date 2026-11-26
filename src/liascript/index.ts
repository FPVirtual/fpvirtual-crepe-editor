export { cardViewAt, LiaCardView, liaCardView } from './card-view'
export { CATEGORIES, exampleImage, examplesByCategory, LIA_EXAMPLES, type LiaCategory, type LiaExample } from './catalog'
export { classifyBlock, type LiaKind } from './classify'
export { joinDocument, splitDocument, type LmsConfig, type SplitDocument } from './header'
export { fillCard, LIA_BLOCK, liaBlockNode, remarkLiaBlocks, remarkLiaPlugin } from './lia-block'
export { blockKey, SourcePreserver, type BlockSlice } from './preserve'
export { summarizeQuiz, type QuizSummary } from './quiz'
export { extractHeaderMacros, LIA_TEMPLATES, macroSource, type HeaderMacro, type LiaTemplate } from './templates'

export { COLUMN_OPEN, COLUMNS_OPEN, MAX_WIDTH, MIN_WIDTH, groupColumns, imageWithWidth, widthComment } from './columns'
export { LIA_COLUMN, LIA_COLUMNS } from './columns-node'

import { liaCardView } from './card-view'
import { liaColumnNode, liaColumnsNode } from './columns-node'
import { liaBlockNode, remarkLiaPlugin } from './lia-block'

/** Plugins Milkdown del dialecto LiaScript (remark + nodo atómico + tarjeta editable + columnas). */
export const liascript = [remarkLiaPlugin, liaBlockNode, liaCardView, liaColumnNode, liaColumnsNode].flat()
