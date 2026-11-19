export { classifyBlock, type LiaKind } from './classify'
export { joinDocument, splitDocument, type LmsConfig, type SplitDocument } from './header'
export { LIA_BLOCK, liaBlockNode, remarkLiaBlocks, remarkLiaPlugin } from './lia-block'
export { blockKey, SourcePreserver, type BlockSlice } from './preserve'
export { summarizeQuiz, type QuizSummary } from './quiz'

import { liaBlockNode, remarkLiaPlugin } from './lia-block'

/** Plugins Milkdown del dialecto LiaScript (remark + nodo atómico). */
export const liascript = [remarkLiaPlugin, liaBlockNode].flat()
