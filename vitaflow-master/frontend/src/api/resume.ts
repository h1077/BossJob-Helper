import request from "./request"
import type { ResumeItem } from "@/types/resume"

export interface ResumeListParams {
  page?: number
  page_size?: number
}

export interface ResumePage {
  items: ResumeItem[]
  total: number
  page: number
  page_size: number
}

export interface ResumeShareSettings {
  enabled: boolean
  active: boolean
  token?: string | null
  path?: string | null
  expire_time?: string | null
  created_time?: string | null
  mask_sensitive: boolean
}

export interface PublicSharedResume {
  title: string
  html: string
  expire_time?: string | null
}

export const listResumesApi = (params: ResumeListParams = {}) => request.get<ResumePage, ResumePage>("/resumes", { params })
export const createResumeApi = (data: Partial<ResumeItem>) => request.post<any, ResumeItem>("/resumes", data)
export const createResumeFromStarterApi = (data: { starter_id: string; level_id: string; template_id?: string }) => request.post<any, ResumeItem>("/resumes/from-starter", data)
export const getResumeApi = (id: number) => request.get<ResumeItem, ResumeItem>(`/resumes/${id}`)
export const updateResumeApi = (id: number, data: Partial<ResumeItem>) => request.put<any, ResumeItem>(`/resumes/${id}`, data)
export const deleteResumeApi = (id: number) => request.delete(`/resumes/${id}`)
export const duplicateResumeApi = (id: number) => request.post<any, ResumeItem>(`/resumes/${id}/duplicate`)
export const getResumeShareApi = (id: number) => request.get<ResumeShareSettings, ResumeShareSettings>(`/resumes/${id}/share`)
export const updateResumeShareApi = (id: number, data: { enabled: boolean; expire_time?: string | null; regenerate_token?: boolean; mask_sensitive?: boolean; custom_token?: string }) =>
  request.put<ResumeShareSettings, ResumeShareSettings>(`/resumes/${id}/share`, data)
export const getPublicSharedResumeApi = (token: string) => request.get<PublicSharedResume, PublicSharedResume>(`/shares/${encodeURIComponent(token)}`)
export const previewHtmlApi = (id: number) => request.get<string, string>(`/resumes/${id}/preview-html`, { responseType: "text" as any })
export const importResumeFileApi = (file: File | File[], templateId = "tech") => {
  const form = new FormData()
  const files = Array.isArray(file) ? file : [file]
  files.forEach((item) => form.append("files", item))
  form.append("template_id", templateId)
  return request.post<any, ResumeItem>("/resumes/import-file", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000,
  } as any)
}
/** 获取简历的 PDF 预览文件流 */
export async function previewPdfApi(id: number): Promise<Blob> {
  const res = await request.get(`/resumes/${id}/preview-pdf`, { responseType: "blob", timeout: 120000 })
  return ((res as any).data || res) as Blob
}
