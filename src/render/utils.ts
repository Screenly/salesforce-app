export function renderEmpty(container: HTMLElement): void {
  const p = document.createElement('p')
  p.className = 'empty-state text-[#9d9d9f] text-sm text-center m-auto'
  p.textContent = 'No data available'
  container.appendChild(p)
}
