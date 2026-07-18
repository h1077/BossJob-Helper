import request from "./request"

export interface TemplateItem {
  template_id: string
  name: string
  category: string
  is_pro: boolean
  preview_html?: string
}

export const listTemplatesApi = () => request.get<TemplateItem[], TemplateItem[]>("/templates")
