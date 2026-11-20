export { cardViewAt, LiaCardView, liaCardView } from './card-view'
export { classifyBlock, type LiaKind } from './classify'
export { joinDocument, splitDocument, type LmsConfig, type SplitDocument } from './header'
export { fillCard, LIA_BLOCK, liaBlockNode, remarkLiaBlocks, remarkLiaPlugin } from './lia-block'
export { blockKey, SourcePreserver, type BlockSlice } from './preserve'
export { summarizeQuiz, type QuizSummary } from './quiz'
export { extractHeaderMacros, LIA_TEMPLATES, macroSource, type HeaderMacro, type LiaTemplate } from './templates'

import { liaCardView } from './card-view'
import { liaBlockNode, remarkLiaPlugin } from './lia-block'

/** Plugins Milkdown del dialecto LiaScript (remark + nodo atómico + tarjeta editable). */
export const liascript = [remarkLiaPlugin, liaBlockNode, liaCardView].flat()
