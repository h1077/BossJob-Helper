let globalToastTimer: ReturnType<typeof setTimeout> | undefined

export function showGlobalToast(message: string, type: "success" | "error" = "success") {
  let div = document.getElementById("vitaflow-global-toast") as HTMLDivElement
  if (!div) {
    div = document.createElement("div")
    div.id = "vitaflow-global-toast"
    div.className = "fixed z-[9999] flex w-max max-w-[90vw] items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-[14px] font-medium text-white shadow-xl border border-zinc-800 transition-all duration-300 opacity-0"
    div.style.left = "50%"
    div.style.bottom = "2.5rem" // bottom-10
    div.style.transform = "translate(-50%, 20px)"
    
    // Add inner HTML structure
    div.innerHTML = `
      <div class="toast-icon shrink-0"></div>
      <span class="break-words"></span>
    `
    document.body.appendChild(div)
  }
  
  const iconContainer = div.querySelector(".toast-icon")
  const span = div.querySelector("span")
  
  if (iconContainer) {
    if (type === "success") {
      iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    } else {
      iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    }
  }
  
  if (span) span.textContent = message
  
  if (globalToastTimer) clearTimeout(globalToastTimer)
  
  requestAnimationFrame(() => {
    div.style.transform = "translate(-50%, 0)"
    div.style.opacity = "1"
  })
  
  globalToastTimer = setTimeout(() => {
    div.style.transform = "translate(-50%, 20px)"
    div.style.opacity = "0"
    setTimeout(() => {
      div?.remove()
    }, 300)
  }, 3000)
}
