// Cajas de aviso (@nota, @aviso…): reconocimiento y texto en línea.

import { describe, expect, it } from 'vitest'

import { parseBox, renderInline } from '../src/liascript/box'
import { fillCard } from '../src/liascript/lia-block'

const html = (nodes: Node[]) => {
  const div = document.createElement('div')
  div.append(...nodes)
  return div.innerHTML
}

describe('parseBox', () => {
  it('reconoce las cinco cajas con el tipo de la web publicada', () => {
    expect(parseBox('@nota(`Hola`)')).toEqual({ name: 'nota', type: 'info', text: 'Hola' })
    expect(parseBox('@consejo(`a`)')?.type).toBe('tip')
    expect(parseBox('@aviso(`a`)')?.type).toBe('warning')
    expect(parseBox('@importante(`a`)')?.type).toBe('important')
    expect(parseBox('@error(`a`)')?.type).toBe('caution')
  })

  it('admite texto sin comillas invertidas', () => {
    expect(parseBox('@nota(Este párrafo usa la macro.)')?.text).toBe('Este párrafo usa la macro.')
  })

  it('no reconoce otras macros ni cajas con texto alrededor', () => {
    expect(parseBox('@LIA.eval(`a`)')).toBeNull()
    expect(parseBox('Texto @nota(`a`)')).toBeNull()
    expect(parseBox('@nota(`a`) y más')).toBeNull()
    expect(parseBox('@nota(`a`, `b`)')).toBeNull()
  })
})

describe('renderInline', () => {
  it('negrita, cursiva, código y escapes', () => {
    expect(html(renderInline('Usa **session\\_start** y *luego* `$_SESSION`'))).toBe(
      'Usa <strong>session_start</strong> y <em>luego</em> <code>$_SESSION</code>',
    )
  })

  it('no interpreta HTML', () => {
    expect(html(renderInline('<b>x</b>'))).toBe('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('tarjeta de caja', () => {
  it('se pinta como contenedor hope con título y guarda el texto original', () => {
    const source = '@aviso(`Comprueba **PHP**.`)'
    const card = fillCard(document.createElement('div'), source, 'macro')
    expect(card.classList.contains('hint-container')).toBe(true)
    expect(card.classList.contains('warning')).toBe(true)
    expect(card.querySelector('.lia-card__label')?.textContent).toBe('Aviso')
    expect(card.querySelector('.lia-card__box-text')?.innerHTML).toBe('Comprueba <strong>PHP</strong>.')
    expect(card.dataset.value).toBe(source)
  })

  it('las demás macros siguen como tarjeta de código', () => {
    const card = fillCard(document.createElement('div'), '@LIA.eval(`a`)', 'macro')
    expect(card.classList.contains('hint-container')).toBe(false)
    expect(card.querySelector('.lia-card__source')).not.toBeNull()
  })
})
