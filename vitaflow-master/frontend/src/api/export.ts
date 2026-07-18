import request from "./request"

function safeFilename(value: string | undefined, fallback: string) {
  const name = String(value || "").trim() || fallback
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").slice(0, 80) || fallback
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function exportPdfApi(id: number, title?: string) {
  const res = await request.post(`/resumes/${id}/export/pdf`, {}, { responseType: "blob", timeout: 120000 })
  downloadBlob((res as any).data, `${safeFilename(title, `vitaflow_resume_${id}`)}.pdf`)
}

export async function exportWordApi(id: number, title?: string) {
  const res = await request.post(`/resumes/${id}/export/word`, {}, { responseType: "blob", timeout: 120000 })
  downloadBlob((res as any).data, `${safeFilename(title, `vitaflow_resume_${id}`)}.docx`)
}
