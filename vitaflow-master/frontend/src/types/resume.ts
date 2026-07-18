export interface ResumeItem {
  id: number
  user_id: number
  title: string
  language: string
  resume_data: ResumeData
  template_id: string
  template_config: TemplateConfig
  create_time?: string
  update_time?: string
}

export interface TemplateConfig {
  template_id: string
  theme_color: string
  font_family: string
  name_font_size: number
  name_font_color: string
  title_font_size: number
  title_font_color: string
  body_font_size: number
  body_font_color: string
  bg_color: string
  icon_color: string
  header_icon_color: string
  line_height: number
  page_margin_top: number
  page_margin_right: number
  page_margin_bottom: number
  page_margin_left: number
  next_page_margin_top: number
  next_page_margin_bottom: number
  section_margin_top: number
  section_margin_bottom: number
  section_title_margin_bottom: number
  show_avatar: boolean
  avatar_position: "left" | "center" | "right"
}

export interface ResumeData {
  basics: Record<string, any>
  summary: { content: string }
  education: any[]
  skills: any[]
  work: any[]
  projects: any[]
  awards: any[]
  custom_sections: any[]
  layout: {
    section_order: string[]
    hidden_sections: string[]
    section_titles: Record<string, string>
    field_labels?: Record<string, Record<string, string>>
    language_locked?: boolean
    skills_options?: {
      show_keywords: boolean
      description_inline: boolean
    }
  }
}
