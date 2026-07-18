import { defineStore } from "pinia"
import { createResumeApi, createResumeFromStarterApi, deleteResumeApi, duplicateResumeApi, getResumeApi, listResumesApi, previewHtmlApi, previewPdfApi, updateResumeApi } from "@/api/resume"
import type { ResumeData, ResumeItem, TemplateConfig } from "@/types/resume"
import { applyResumeLanguage, defaultFieldConfigLabel, defaultSectionTitle, normalizeResumeLanguage, resolveResumeLanguage } from "@/utils/resumeLocale"

const builtInSections = ["basics", "summary", "education", "skills", "work", "projects", "awards"]

export function normalizeResumeData(input: any, language: unknown = "zh-CN"): ResumeData {
  const normalizedLanguage = normalizeResumeLanguage(language)
  const data = input && typeof input === "object" ? input : {}
  if (!data.basics || typeof data.basics !== "object" || Array.isArray(data.basics)) data.basics = {}
  if (!Array.isArray(data.basics.custom_fields)) data.basics.custom_fields = []
  if (!data.basics.field_config || typeof data.basics.field_config !== "object" || Array.isArray(data.basics.field_config)) data.basics.field_config = {
    phone: { label: defaultFieldConfigLabel("phone", normalizedLanguage), icon: "Phone", row: 1, order: 1 },
    email: { label: defaultFieldConfigLabel("email", normalizedLanguage), icon: "Mail", row: 1, order: 2 },
    status: { label: defaultFieldConfigLabel("status", normalizedLanguage), icon: "Info", row: 1, order: 3 },
    location: { label: defaultFieldConfigLabel("location", normalizedLanguage), icon: "MapPin", row: 1, order: 4 },
    highest_degree: { label: defaultFieldConfigLabel("highest_degree", normalizedLanguage), icon: "GraduationCap", row: 2, order: 1 },
    website: { label: defaultFieldConfigLabel("website", normalizedLanguage), icon: "Globe", row: 2, order: 2 },
    github: { label: defaultFieldConfigLabel("github", normalizedLanguage), icon: "Github", row: 2, order: 3 },
    expected_salary: { label: defaultFieldConfigLabel("expected_salary", normalizedLanguage), icon: "Briefcase", row: 2, order: 4 },
  }
  const defaultFieldConfig: Record<string, any> = {
    phone: { label: defaultFieldConfigLabel("phone", normalizedLanguage), icon: "Phone", row: 1, order: 1 },
    email: { label: defaultFieldConfigLabel("email", normalizedLanguage), icon: "Mail", row: 1, order: 2 },
    status: { label: defaultFieldConfigLabel("status", normalizedLanguage), icon: "Info", row: 1, order: 3 },
    location: { label: defaultFieldConfigLabel("location", normalizedLanguage), icon: "MapPin", row: 1, order: 4 },
    highest_degree: { label: defaultFieldConfigLabel("highest_degree", normalizedLanguage), icon: "GraduationCap", row: 2, order: 1 },
    website: { label: defaultFieldConfigLabel("website", normalizedLanguage), icon: "Globe", row: 2, order: 2 },
    github: { label: defaultFieldConfigLabel("github", normalizedLanguage), icon: "Github", row: 2, order: 3 },
    expected_salary: { label: defaultFieldConfigLabel("expected_salary", normalizedLanguage), icon: "Briefcase", row: 2, order: 4 },
  }
  for (const [key, value] of Object.entries(defaultFieldConfig)) {
    const current = data.basics.field_config[key]
    data.basics.field_config[key] = { ...value, ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}) }
  }
  data.summary ||= { content: "" }
  if (typeof data.summary === "string") data.summary = { content: data.summary }

  const stripFragments = (str: string) => {
    if (typeof str !== "string") return str
    return str.replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "")
  }

  if (data.summary?.content) {
    data.summary.content = stripFragments(data.summary.content)
  }
  for (const key of ["education", "skills", "work", "projects", "awards", "custom_sections"]) {
    if (!Array.isArray(data[key])) data[key] = []
    for (const item of data[key]) {
      if (item && typeof item === "object") {
        if (typeof item.description === "string") item.description = stripFragments(item.description)
        if (Array.isArray(item.highlights)) {
          item.highlights = item.highlights.map((h: any) => stripFragments(typeof h === "string" ? h : ""))
        }
        if (Array.isArray(item.items)) {
          for (const subItem of item.items) {
            if (subItem && typeof subItem === "object") {
              if (typeof subItem.description === "string") subItem.description = stripFragments(subItem.description)
              if (Array.isArray(subItem.highlights)) {
                subItem.highlights = subItem.highlights.map((h: any) => stripFragments(typeof h === "string" ? h : ""))
              }
            }
          }
        }
      }
    }
  }
  data.layout ||= {}
  const customIds = data.custom_sections.map((item: any) => item.id).filter(Boolean)
  data.layout.section_order = Array.isArray(data.layout.section_order) && data.layout.section_order.length
    ? data.layout.section_order.filter((key: string) => builtInSections.includes(key) || customIds.includes(key))
    : [...builtInSections, ...customIds]
  for (const key of [...builtInSections, ...customIds]) {
    if (!data.layout.section_order.includes(key)) data.layout.section_order.push(key)
  }
  data.layout.section_order = ["basics", ...data.layout.section_order.filter((key: string) => key !== "basics")]
  data.layout.hidden_sections = Array.isArray(data.layout.hidden_sections) ? data.layout.hidden_sections.filter((key: string) => key !== "basics") : []
  if (!data.layout.skills_options || typeof data.layout.skills_options !== "object" || Array.isArray(data.layout.skills_options)) {
    data.layout.skills_options = {}
  }
  data.layout.skills_options = {
    show_keywords: data.layout.skills_options.show_keywords !== false,
    description_inline: data.layout.skills_options.description_inline === true,
  }
  if (!data.layout.field_labels || typeof data.layout.field_labels !== "object" || Array.isArray(data.layout.field_labels)) {
    data.layout.field_labels = {}
  }
  for (const [sectionKey, labels] of Object.entries(data.layout.field_labels)) {
    if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
      delete data.layout.field_labels[sectionKey]
      continue
    }
    data.layout.field_labels[sectionKey] = Object.fromEntries(
      Object.entries(labels).filter(([, value]) => typeof value === "string"),
    )
  }
  
  data.layout.section_titles ||= {}
  for (const key of builtInSections) {
    if (!data.layout.section_titles[key] || data.layout.section_titles[key] === key) {
      data.layout.section_titles[key] = defaultSectionTitle(key, normalizedLanguage) || key
    }
  }
  for (const item of data.custom_sections) {
    if (!data.layout.section_titles[item.id] || data.layout.section_titles[item.id] === item.id) {
      data.layout.section_titles[item.id] = item.title || "自定义模块"
    }
  }
  applyResumeLanguage(data as ResumeData, normalizedLanguage, normalizedLanguage)
  return data as ResumeData
}

export function normalizeTemplateConfig(input: any, templateId = "tech"): TemplateConfig {
  const templateDefaults: Record<string, { theme_color: string; bg_color: string; icon_color: string; line_height?: number }> = {
    classic: { theme_color: "#2563eb", bg_color: "#ffffff", icon_color: "#2563eb" },
    tech: { theme_color: "#2563eb", bg_color: "#ffffff", icon_color: "#2563eb" },
    modern: { theme_color: "#0f766e", bg_color: "#ffffff", icon_color: "#ffffff" },
    blue_timeline: { theme_color: "#4673f4", bg_color: "#ffffff", icon_color: "#ffffff" },
    minimal_light: { theme_color: "#333333", bg_color: "#ffffff", icon_color: "#333333" },
    minimal_mono: { theme_color: "#000000", bg_color: "#ffffff", icon_color: "#6b7280" },
    modern_clean: { theme_color: "#0f766e", bg_color: "#ffffff", icon_color: "#0f766e" },
    elegant_line: { theme_color: "#111827", bg_color: "#ffffff", icon_color: "#111827" },
    editorial_serif: { theme_color: "#8f2d3b", bg_color: "#ffffff", icon_color: "#8f2d3b" },
    executive_panel: { theme_color: "#1f3a5f", bg_color: "#ffffff", icon_color: "#ffffff" },
    portfolio_cards: { theme_color: "#2f855a", bg_color: "#ffffff", icon_color: "#2f855a" },
    compact_matrix: { theme_color: "#475569", bg_color: "#ffffff", icon_color: "#475569", line_height: 1.45 },
  }
  const defaults = templateDefaults[templateId] || templateDefaults.tech
  const pageMarginTop = input?.page_margin_top ?? 14
  const pageMarginBottom = input?.page_margin_bottom ?? 14
  return {
    theme_color: input?.theme_color || defaults.theme_color,
    bg_color: input?.bg_color || defaults.bg_color,
    font_family: input?.font_family || "vf-sans",
    name_font_size: 28,
    name_font_color: "#111827",
    title_font_size: 16,
    title_font_color: "#111827",
    body_font_size: 13,
    body_font_color: "#374151",
    icon_color: input?.icon_color || input?.theme_color || defaults.icon_color,
    header_icon_color: input?.header_icon_color || input?.icon_color || input?.theme_color || defaults.icon_color,
    line_height: input?.line_height || defaults.line_height || 1.6,
    page_margin_right: 16,
    page_margin_left: 16,
    section_margin_top: 10,
    section_margin_bottom: 10,
    section_title_margin_bottom: 6,
    show_avatar: true,
    ...(input || {}),
    avatar_position: ["left", "center", "right"].includes(input?.avatar_position) ? input.avatar_position : "right",
    page_margin_top: pageMarginTop,
    page_margin_bottom: pageMarginBottom,
    next_page_margin_top: input?.next_page_margin_top ?? pageMarginTop,
    next_page_margin_bottom: input?.next_page_margin_bottom ?? pageMarginBottom,
    template_id: input?.template_id || templateId,
  }
}

export const useResumeStore = defineStore("resume", {
  state: () => ({
    resumeList: [] as ResumeItem[],
    resumeListPage: 1,
    resumeListPageSize: 8,
    resumeListTotal: 0,
    currentResume: null as ResumeItem | null,
    previewHtml: "",
    previewPdfBlob: null as Blob | null,
  }),
  getters: {
    resumeData: (state) => state.currentResume?.resume_data as ResumeData | undefined,
    templateConfig: (state) => state.currentResume?.template_config as TemplateConfig | undefined,
  },
  actions: {
    async fetchResumeList(page?: number, pageSize?: number) {
      const nextPage = page ?? this.resumeListPage
      const nextPageSize = pageSize ?? this.resumeListPageSize
      const result = await listResumesApi({ page: nextPage, page_size: nextPageSize })
      this.resumeList = result.items
      this.resumeListPage = result.page
      this.resumeListPageSize = result.page_size
      this.resumeListTotal = result.total
    },
    async fetchResumeDetail(id: number) {
      this.currentResume = await getResumeApi(id)
      if (this.currentResume) {
        this.currentResume.language = resolveResumeLanguage(this.currentResume.language, this.currentResume.resume_data)
        this.currentResume.resume_data = normalizeResumeData(this.currentResume.resume_data, this.currentResume.language)
        this.currentResume.template_config = normalizeTemplateConfig(this.currentResume.template_config, this.currentResume.template_id)
      }
      await this.refreshPreviewHtml()
    },
    async createResume(templateId = "tech") {
      return await createResumeApi({
        title: "我的简历",
        template_id: templateId,
        template_config: normalizeTemplateConfig({}, templateId),
      } as any)
    },
    async createResumeFromStarter(starterId: string, levelId = "junior", templateId = "__industry_default") {
      return await createResumeFromStarterApi({
        starter_id: starterId,
        level_id: levelId,
        template_id: templateId,
      })
    },
    async createResumeFromAi(result: any) {
      const rawResumeData = result?.resume_data?.resume_data || result?.resume_data || result?.optimized_resume_data || (result?.basics ? result : null)
      const language = normalizeResumeLanguage(result?.language)
      const resumeData = normalizeResumeData(rawResumeData, language)
      if (!resumeData) throw new Error("AI 生成结果中没有简历数据")
      const title = resumeData?.basics?.title || result?.target_position || "AI 生成简历"
      const templateId = String(result.template_id || "tech")
      return await createResumeApi({
        title,
        language,
        template_id: templateId,
        resume_data: resumeData,
        template_config: normalizeTemplateConfig(result.template_config, templateId),
      } as any)
    },
    async updateResume(payload?: Partial<ResumeItem>) {
      if (!this.currentResume) return
      const updated = await updateResumeApi(this.currentResume.id, payload || this.currentResume)
      updated.language = resolveResumeLanguage(updated.language, updated.resume_data)
      updated.resume_data = normalizeResumeData(updated.resume_data, updated.language)
      updated.template_config = normalizeTemplateConfig(updated.template_config, updated.template_id)
      this.currentResume = updated
      const index = this.resumeList.findIndex(item => item.id === updated.id)
      if (index !== -1) {
        this.resumeList[index] = { ...this.resumeList[index], ...updated }
      }
    },
    async deleteResume(id: number) {
      await deleteResumeApi(id)
      const nextTotal = Math.max(0, this.resumeListTotal - 1)
      const maxPage = Math.max(1, Math.ceil(nextTotal / this.resumeListPageSize))
      await this.fetchResumeList(Math.min(this.resumeListPage, maxPage), this.resumeListPageSize)
    },
    async duplicateResume(id: number) {
      await duplicateResumeApi(id)
      await this.fetchResumeList(1, this.resumeListPageSize)
    },
    updateResumeData(data: ResumeData) {
      if (this.currentResume) this.currentResume.resume_data = normalizeResumeData(data, this.currentResume.language)
    },
    updateTemplateConfig(config: TemplateConfig) {
      if (this.currentResume) this.currentResume.template_config = config
    },
    async refreshPreviewHtml() {
      if (!this.currentResume) return
      this.previewHtml = await previewHtmlApi(this.currentResume.id)
    },
    async refreshPreviewPdf() {
      if (!this.currentResume) return
      this.previewPdfBlob = await previewPdfApi(this.currentResume.id)
    },
  },
})
