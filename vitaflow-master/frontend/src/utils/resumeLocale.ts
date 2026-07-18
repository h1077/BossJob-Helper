import type { ResumeData } from "@/types/resume"

export type ResumeLanguage = "zh-CN" | "en"

export const resumeLocales = {
  "zh-CN": {
    sectionTitles: {
      basics: "基本信息",
      summary: "个人简介",
      education: "教育经历",
      skills: "专业技能",
      work: "工作经历",
      projects: "项目经历",
      awards: "荣誉奖项",
    },
    fieldConfig: {
      phone: "电话",
      email: "邮箱",
      status: "当前状态",
      location: "地点",
      highest_degree: "最高学历",
      website: "个人网站",
      github: "代码仓库",
      expected_salary: "期望薪资",
    },
    fieldLabels: {
      projectTechStack: "技术栈",
      customTechStack: "技术/工具",
    },
  },
  en: {
    sectionTitles: {
      basics: "Contact",
      summary: "Professional Summary",
      education: "Education",
      skills: "Skills",
      work: "Work Experience",
      projects: "Project Experience",
      awards: "Awards",
    },
    fieldConfig: {
      phone: "Phone",
      email: "Email",
      status: "Status",
      location: "Location",
      highest_degree: "Education",
      website: "Website",
      github: "GitHub",
      expected_salary: "Expected Salary",
    },
    fieldLabels: {
      projectTechStack: "Tech Stack",
      customTechStack: "Tools",
    },
  },
} as const

export function normalizeResumeLanguage(value: unknown): ResumeLanguage {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "zh-CN"
}

function displayText(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(displayText)
  if (!value || typeof value !== "object") return []
  const ignoredKeys = new Set(["id", "icon", "preset_type", "avatar", "url", "website", "github", "field_config", "layout"])
  return Object.entries(value)
    .filter(([key]) => !ignoredKeys.has(key))
    .flatMap(([, item]) => displayText(item))
}

export function resolveResumeLanguage(value: unknown, data?: ResumeData): ResumeLanguage {
  const stored = normalizeResumeLanguage(value)
  if (!data || data.layout?.language_locked === true || stored === "en") return stored
  const titleValues = new Set(Object.values(data.layout?.section_titles || {}))
  const englishTitles = new Set<string>(Object.values(resumeLocales.en.sectionTitles))
  const chineseTitles = new Set<string>(Object.values(resumeLocales["zh-CN"].sectionTitles))
  const englishHits = [...titleValues].filter((title) => englishTitles.has(title)).length
  const chineseHits = [...titleValues].filter((title) => chineseTitles.has(title)).length
  if (englishHits >= 2 && englishHits > chineseHits) return "en"

  const text = displayText(data).join("\n")
  const hanCount = (text.match(/[\u3400-\u9fff]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length
  return latinCount >= 40 && latinCount > hanCount * 2 ? "en" : "zh-CN"
}

export function defaultSectionTitle(key: string, language: unknown) {
  return resumeLocales[normalizeResumeLanguage(language)].sectionTitles[key as keyof typeof resumeLocales["zh-CN"]["sectionTitles"]]
}

export function defaultFieldConfigLabel(key: string, language: unknown) {
  return resumeLocales[normalizeResumeLanguage(language)].fieldConfig[key as keyof typeof resumeLocales["zh-CN"]["fieldConfig"]]
}

export function effectiveFieldLabel(data: ResumeData, sectionKey: string, fieldKey: string, language: unknown, custom = false) {
  const configured = data.layout.field_labels?.[sectionKey]?.[fieldKey]
  if (typeof configured === "string") return configured
  if (fieldKey !== "tech_stack") return ""
  const locale = resumeLocales[normalizeResumeLanguage(language)]
  return custom ? locale.fieldLabels.customTechStack : locale.fieldLabels.projectTechStack
}

export function applyResumeLanguage(data: ResumeData, previousLanguage: unknown, nextLanguage: unknown) {
  const previous = resumeLocales[normalizeResumeLanguage(previousLanguage)]
  const next = resumeLocales[normalizeResumeLanguage(nextLanguage)]
  const previousTitles = previous.sectionTitles as Record<string, string>
  const nextTitles = next.sectionTitles as Record<string, string>
  data.layout.section_titles ||= {}
  for (const key of Object.keys(next.sectionTitles)) {
    const current = data.layout.section_titles[key]
    const knownDefaults = Object.values(resumeLocales).map((locale) => (locale.sectionTitles as Record<string, string>)[key])
    if (!current || current === key || current === previousTitles[key] || knownDefaults.includes(current)) {
      data.layout.section_titles[key] = nextTitles[key]
    }
  }

  const fieldConfig = data.basics?.field_config
  if (fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)) {
    const nextFieldConfig = next.fieldConfig as Record<string, string>
    for (const key of Object.keys(next.fieldConfig)) {
      const config = fieldConfig[key]
      if (!config || typeof config !== "object" || Array.isArray(config)) continue
      const knownDefaults = Object.values(resumeLocales).map((locale) => (locale.fieldConfig as Record<string, string>)[key])
      if (!config.label || knownDefaults.includes(config.label)) {
        config.label = nextFieldConfig[key]
      }
    }
  }
}
