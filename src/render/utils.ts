export function renderEmpty(container: HTMLElement): void {
  const p = document.createElement('p')
  p.className = 'empty-state'
  p.textContent = 'No data available'
  container.appendChild(p)
}
