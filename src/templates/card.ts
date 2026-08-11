import { html, render, type TemplateResult } from 'lit-html'
import { ref } from 'lit-html/directives/ref.js'
import type { Card } from './card.types'

function cardTemplate(card: Card): TemplateResult {
  const cardClasses = ['chart-card', card.cardClassName]
    .filter(Boolean)
    .join(' ')
  const containerClasses = ['chart-container', card.containerClassName]
    .filter(Boolean)
    .join(' ')

  return html`
    <div class=${cardClasses} style=${card.gridStyle ?? ''}>
      <h3 class="chart-title">${card.title}</h3>
      <div class=${containerClasses} ${ref(card.contentRef)}></div>
    </div>
  `
}

export function mountCards(chartsGrid: HTMLElement, cards: Card[]): void {
  render(html`${cards.map((card) => cardTemplate(card))}`, chartsGrid)

  for (const card of cards) {
    if (card.contentRef.value) card.draw(card.contentRef.value)
  }
}
