import request from "./request"

export interface ResumeStarterLevel {
  id: string
  label: string
  short_label: string
  status: string
}

export interface ResumeStarterRole {
  starter_id: string
  title: string
  subtitle: string
  default_template_id?: string
  keywords: string[]
  focus: string[]
  content: {
    modules?: Array<{ key: string; title: string }>
    summary?: string
    skills?: Array<{ name: string; keywords: string[]; description: string }>
    work?: { position?: string; description?: string; highlights?: string[] }
    project?: { name?: string; role?: string; tech_stack?: string; description?: string; highlights?: string[] }
  }
}

export interface ResumeStarterIndustry {
  id: string
  name: string
  description: string
  roles: ResumeStarterRole[]
}

export interface ResumeStarterCatalog {
  levels: ResumeStarterLevel[]
  industries: ResumeStarterIndustry[]
}

export const listResumeStartersApi = (params?: { industry_id?: string }) =>
  request.get<ResumeStarterCatalog, ResumeStarterCatalog>("/resume-starters", { params })
