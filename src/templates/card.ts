import { html, nothing, render, type TemplateResult } from 'lit-html'
import { ref } from 'lit-html/directives/ref.js'
import type { Card } from './card.types'

function footerTemplate(card: Card): TemplateResult | typeof nothing {
  if (!card.footer && !card.asOf) return nothing

  return html`
    <div class="chart-footer">
      <span class="chart-footer-note">${card.footer ?? ''}</span>
      <span class="chart-footer-date">${card.asOf ?? ''}</span>
    </div>
  `
}

function cardTemplate(card: Card): TemplateResult {
  const cardClasses = ['chart-card', card.cardClassName]
    .filter(Boolean)
    .join(' ')
  const containerClasses = ['chart-container', card.containerClassName]
    .filter(Boolean)
    .join(' ')

  return html`
    <div class=${cardClasses} style=${card.gridStyle ?? ''}>
      <div class="chart-heading">
        <h3 class="chart-title">${card.title}</h3>
        ${
          card.subtitle
            ? html`<p class="chart-subtitle">${card.subtitle}</p>`
            : nothing
        }
      </div>
      <div class=${containerClasses} ${ref(card.contentRef)}></div>
      ${footerTemplate(card)}
    </div>
  `
}

export function mountCards(chartsGrid: HTMLElement, cards: Card[]): void {
  render(html`${cards.map((card) => cardTemplate(card))}`, chartsGrid)

  for (const card of cards) {
    if (card.contentRef.value) card.draw(card.contentRef.value)
  }
}
