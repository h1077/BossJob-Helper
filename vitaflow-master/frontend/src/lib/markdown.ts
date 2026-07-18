import MarkdownIt from "markdown-it"
import DOMPurify from "dompurify"

const md = new MarkdownIt({ breaks: true, linkify: true })

export function renderMarkdown(text = "") {
  return DOMPurify.sanitize(md.render(localizeAiText(text)))
}

const INTERNAL_FIELD_LABELS: Record<string, string> = {
  optimized_resume_data: "优化后的简历内容",
  resume_data: "简历内容",
  field_config: "基本信息展示配置",
  highest_degree: "最高学历",
  start_date: "开始时间",
  end_date: "结束时间",
  tech_stack: "技术栈",
  description: "描述",
  highlights: "亮点",
  highlight: "亮点",
  keywords: "关键词",
  basics: "基本信息",
  summary: "个人简介",
  skills: "专业技能",
  projects: "项目经历",
}

export function localizeAiText(text = "") {
  let result = text
  for (const [field, label] of Object.entries(INTERNAL_FIELD_LABELS).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp(`(^|[^A-Za-z0-9_])${field}(?=$|[^A-Za-z0-9_])`, "gi"), `$1${label}`)
  }
  return result
}
