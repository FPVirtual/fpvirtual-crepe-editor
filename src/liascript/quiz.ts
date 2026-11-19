// Resumen de un bloque de quiz LiaScript para mostrarlo como tarjeta (R4).
// No ejecuta ni valida el quiz: solo extrae opciones y respuestas marcadas.

export interface QuizOption {
  text: string
  correct: boolean
}

export interface QuizSummary {
  type: 'single' | 'multiple' | 'text' | 'other'
  options: QuizOption[]
  hints: number
}

const SINGLE = /^\[\((X|x| )?\)\]\s*(.*)$/
const MULTIPLE = /^\[\[(X|x| )?\]\]\s*(.*)$/
const HINT = /^\[\[\?\]\]/
const TEXT = /^\[\[([^\]]+)\]\]\s*$/

export function summarizeQuiz(source: string): QuizSummary {
  const summary: QuizSummary = { type: 'other', options: [], hints: 0 }
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (HINT.test(line)) {
      summary.hints++
      continue
    }
    let m = SINGLE.exec(line)
    if (m) {
      summary.type = 'single'
      summary.options.push({ text: m[2], correct: /x/i.test(m[1] ?? '') })
      continue
    }
    m = MULTIPLE.exec(line)
    if (m) {
      summary.type = 'multiple'
      summary.options.push({ text: m[2], correct: /x/i.test(m[1] ?? '') })
      continue
    }
    m = TEXT.exec(line)
    if (m && summary.options.length === 0) {
      summary.type = 'text'
      summary.options.push({ text: m[1], correct: true })
    }
  }
  return summary
}
