import type { Ref } from 'lit-html/directives/ref.js'

export type Card = {
  title: string
  cardClassName?: string
  containerClassName?: string
  gridStyle?: string
  contentRef: Ref<HTMLDivElement>
  draw: (container: HTMLElement) => void
}
