export type DiffKind = "added" | "modified" | "removed"

export interface DiffItem {
  id: string
  kind: DiffKind
  sectionKey: string
  entryKey: string
  title: string
  before?: string
  after?: string
}

export interface SectionDiff {
  key: string
  title: string
  changes: DiffItem[]
}

interface ComparableEntry {
  key: string
  title: string
  text: string
  compareText: string
}

const builtInTitles: Record<string, string> = {
  basics: "基本信息",
  summary: "个人简介",
  education: "教育经历",
  skills: "专业技能",
  work: "实习/工作经历",
  projects: "项目经历",
  awards: "荣誉奖项",
}

const ignoredKeys = new Set(["id", "avatar", "field_config", "layout", "custom_fields", "preset_type"])
const fieldOrder = [
  "name",
  "title",
  "phone",
  "email",
  "status",
  "location",
  "highest_degree",
  "website",
  "github",
  "expected_salary",
  "school",
  "major",
  "degree",
  "company",
  "organization",
  "institution",
  "issuer",
  "publisher",
  "platform",
  "position",
  "role",
  "level",
  "score",
  "award",
  "start_date",
  "end_date",
  "date",
  "credential_id",
  "url",
  "tech_stack",
  "keywords",
  "description",
  "content",
  "highlights",
]
const fieldOrderMap = new Map(fieldOrder.map((key, index) => [key, index]))
const fieldLabels: Record<string, string> = {
  basics: "基本信息",
  summary: "个人简介",
  education: "教育经历",
  skills: "专业技能",
  work: "实习/工作经历",
  projects: "项目经历",
  awards: "荣誉奖项",
  section_type: "模块类型",
  section_title: "模块标题",
  section_content: "模块内容",
  name: "名称",
  title: "标题",
  phone: "电话",
  email: "邮箱",
  status: "当前状态",
  location: "所在城市",
  highest_degree: "最高学历",
  website: "个人网站",
  github: "代码仓库",
  expected_salary: "期望薪资",
  custom_sections: "自定义模块",
  company: "公司",
  organization: "组织",
  institution: "机构",
  issuer: "颁发机构",
  publisher: "期刊/专利号/会议",
  platform: "平台",
  position: "职位",
  role: "角色",
  level: "水平",
  score: "成绩",
  award: "奖项",
  school: "学校",
  major: "专业",
  degree: "学历",
  credential_id: "证书编号",
  url: "链接",
  start_date: "开始时间",
  end_date: "结束时间",
  date: "时间",
  description: "说明",
  content: "内容",
  keywords: "关键词",
  highlights: "亮点",
  tech_stack: "技术栈",
}

function compact(value: unknown): string {
  const text = String(value ?? "")
  if (!/<[a-z][\s\S]*>/i.test(text)) return text.trim()
  const doc = new DOMParser().parseFromString(text, "text/html")
  doc.body.querySelectorAll("br").forEach((node) => node.replaceWith("\n"))
  doc.body.querySelectorAll("p,div,li,blockquote,h1,h2,h3,h4").forEach((node) => node.append("\n"))
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim()
}

function splitTagText(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => compact(item)).filter(Boolean)
  return String(value ?? "")
    .split(/[,，、;；\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatFieldValue(key: string, value: unknown) {
  if (key === "keywords" || key === "tech_stack") return splitTagText(value).join(", ")
  return plain(value)
}

function orderedEntries(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter(([key, item]) => !ignoredKeys.has(key) && formatFieldValue(key, item))
    .sort(([left], [right]) => {
      const leftRank = fieldOrderMap.get(left) ?? 999
      const rightRank = fieldOrderMap.get(right) ?? 999
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.localeCompare(right)
    })
}

function plain(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number") return compact(value)
  if (Array.isArray(value)) return value.map(plain).filter(Boolean).join("\n")
  if (typeof value === "object") {
    return orderedEntries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = formatFieldValue(key, item)
        return text ? `${label(key)}：${text}` : ""
      })
      .filter(Boolean)
      .join("\n")
  }
  return compact(value)
}

function label(key: string) {
  return fieldLabels[key] || key
}

export function localizeFieldText(value: string) {
  let result = value
  Object.entries(fieldLabels)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([key, fieldLabel]) => {
      result = result.replace(new RegExp(`(?<![A-Za-z0-9_])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`, "g"), fieldLabel)
    })
  return result
}

function adviceText(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (Array.isArray(value)) return value.map(adviceText).filter(Boolean).join("；")
  if (typeof value === "object") {
    const item = value as Record<string, unknown>
    const candidate = item.content || item.description || item.text || item.message || item.suggestion
    return candidate === undefined ? "" : adviceText(candidate)
  }
  return compact(value)
}

function stripAdvicePrefix(value: string) {
  return value.replace(/^\s*[-*•]?\s*\d+\s*[.、)]\s*/, "").trim()
}

function isInternalAdvice(value: string) {
  const text = value.toLowerCase()
  return [
    /\b(json|schema|pydantic|resume_data|optimized_resume_data|section_content|section_type|section_title|keywords|tech_stack)\b/i,
    /(字段|属性|key|键名).*(格式|类型|统一|规范|兼容|数组|字符串|对象|结构)/,
    /(数组|字符串|对象|json|结构化).*(格式|形式|字段|解析|兼容)/i,
    /(逗号分隔|分隔的字符串|数组形式|列表形式|数据结构|数据格式)/,
    /(简历解析习惯|ats解析|解析兼容|解析器|可解析)/i,
  ].some((pattern) => pattern.test(text))
}

export function normalizeAiAdviceList(items: unknown[]) {
  const advice = items
    .map((item) => stripAdvicePrefix(adviceText(item)))
    .filter(Boolean)
    .filter((item) => !isInternalAdvice(item))
    .map(localizeFieldText)
    .map(stripAdvicePrefix)
    .filter(Boolean)
  return [...new Set(advice)]
}

function normalizeForCompare(value: string) {
  return value.replace(/\s+/g, " ").replace(/[，。；;,.]/g, "").trim()
}

function compareValue(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return normalizeForCompare(String(value))
  if (Array.isArray(value)) {
    const items = value.map(compareValue).filter(Boolean)
    const primitiveLike = value.every((item) => item === undefined || item === null || typeof item !== "object")
    return (primitiveLike ? items.sort() : items).join("|")
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ignoredKeys.has(key))
      .map(([key, item]) => [key, compareFieldValue(key, item)] as const)
      .filter(([, item]) => item)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${item}`)
      .join("|")
  }
  return normalizeForCompare(String(value))
}

function compareFieldValue(key: string, value: unknown) {
  if (key === "keywords" || key === "tech_stack") {
    return splitTagText(value).map(normalizeForCompare).filter(Boolean).sort().join("|")
  }
  return compareValue(value)
}

function itemTitle(item: any, index: number, fallback: string) {
  return compact(item?.name || item?.company || item?.organization || item?.school || item?.title || item?.position || item?.role || item?.publisher || item?.platform) || `${fallback} ${index + 1}`
}

function itemKey(item: any, index: number) {
  const identity = compact(item?.id || item?.name || item?.company || item?.organization || item?.school || item?.title || item?.position || item?.role || item?.publisher || item?.platform)
  return identity || `item_${index}`
}

function sectionTitle(data: any, key: string) {
  return data?.layout?.section_titles?.[key] || builtInTitles[key] || data?.custom_sections?.find((item: any) => item.id === key)?.title || "自定义模块"
}

function sectionValue(data: any, key: string) {
  if (!data) return undefined
  if (data[key] !== undefined) return data[key]
  return data.custom_sections?.find((item: any) => item.id === key)
}

function hasSection(data: any, key: string) {
  if (!data) return false
  if (Object.prototype.hasOwnProperty.call(data, key)) return true
  return Boolean(data.custom_sections?.some((item: any) => item.id === key))
}

function toEntries(sectionKey: string, value: any, fallbackTitle: string): ComparableEntry[] {
  if (sectionKey === "summary") {
    const text = plain(value?.content ?? value)
    return text ? [{ key: "summary", title: fallbackTitle, text, compareText: compareValue(value?.content ?? value) }] : []
  }
  if (value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.items)) {
    return value.items.map((item: any, index: number) => ({
      key: itemKey(item, index),
      title: itemTitle(item, index, "条目"),
      text: plain(item),
      compareText: compareValue(item),
    }))
  }
  if (Array.isArray(value)) {
    return value.map((item: any, index: number) => ({
      key: itemKey(item, index),
      title: itemTitle(item, index, fallbackTitle),
      text: plain(item),
      compareText: compareValue(item),
    }))
  }
  const text = plain(value)
  return text ? [{ key: sectionKey, title: fallbackTitle, text, compareText: compareValue(value) }] : []
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function entryMatches(item: any, key: string, index: number) {
  return itemKey(item, index) === key
}

function replaceListEntry(current: any[], next: any[], entryKey: string, kind: DiffKind) {
  if (kind === "removed") return current.filter((item, index) => !entryMatches(item, entryKey, index))
  const nextItem = next.find((item, index) => entryMatches(item, entryKey, index))
  if (!nextItem) return current
  const currentIndex = current.findIndex((item, index) => entryMatches(item, entryKey, index))
  if (currentIndex === -1) return [...current, cloneData(nextItem)]
  const result = [...current]
  result[currentIndex] = cloneData(nextItem)
  return result
}

function setSectionValue(data: any, sectionKey: string, value: any) {
  if (Object.prototype.hasOwnProperty.call(data, sectionKey) || builtInTitles[sectionKey]) {
    data[sectionKey] = value
    return
  }
  const index = (data.custom_sections || []).findIndex((item: any) => item.id === sectionKey)
  if (index >= 0) data.custom_sections[index] = value
}

export function buildSelectedResumeData(currentData: any, optimizedData: any, selectedIds: string[], sections: SectionDiff[]) {
  const selected = new Set(selectedIds)
  const result = cloneData(currentData || {})
  const next = cloneData(optimizedData || {})

  sections.forEach((section) => {
    section.changes.forEach((change) => {
      if (!selected.has(change.id)) return
      const currentValue = sectionValue(result, section.key)
      const nextValue = sectionValue(next, section.key)
      if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
        setSectionValue(
          result,
          section.key,
          replaceListEntry(currentValue || [], nextValue || [], change.entryKey, change.kind),
        )
        return
      }
      if (
        currentValue &&
        nextValue &&
        typeof currentValue === "object" &&
        typeof nextValue === "object" &&
        Array.isArray(currentValue.items) &&
        Array.isArray(nextValue.items)
      ) {
        setSectionValue(result, section.key, {
          ...currentValue,
          ...nextValue,
          items: replaceListEntry(currentValue.items, nextValue.items, change.entryKey, change.kind),
        })
        return
      }
      if (change.kind === "removed") {
        setSectionValue(result, section.key, undefined)
      } else {
        setSectionValue(result, section.key, cloneData(nextValue))
      }
    })
  })

  if (next.layout) {
    result.layout = {
      ...(result.layout || {}),
      ...next.layout,
    }
  }
  return result
}

export function diffSection(sectionKey: string, currentValue: any, nextValue: any, title = builtInTitles[sectionKey] || "当前模块"): DiffItem[] {
  const currentEntries = toEntries(sectionKey, currentValue, title)
  const nextEntries = toEntries(sectionKey, nextValue, title)
  const currentMap = new Map(currentEntries.map((item) => [item.key, item]))
  const nextMap = new Map(nextEntries.map((item) => [item.key, item]))
  const changes: DiffItem[] = []

  nextEntries.forEach((item) => {
    const before = currentMap.get(item.key)
    if (!before) {
      changes.push({ id: `${sectionKey}:${item.key}:added`, kind: "added", sectionKey, entryKey: item.key, title: item.title, after: item.text })
      return
    }
    if (before.compareText !== item.compareText) {
      changes.push({ id: `${sectionKey}:${item.key}:modified`, kind: "modified", sectionKey, entryKey: item.key, title: item.title, before: before.text, after: item.text })
    }
  })

  currentEntries.forEach((item) => {
    if (!nextMap.has(item.key)) changes.push({ id: `${sectionKey}:${item.key}:removed`, kind: "removed", sectionKey, entryKey: item.key, title: item.title, before: item.text })
  })

  return changes
}

export function diffResume(currentData: any, optimizedData: any): SectionDiff[] {
  if (!currentData || !optimizedData) return []
  const order = [
    ...new Set([
      "basics",
      ...(currentData.layout?.section_order || []),
      ...(optimizedData.layout?.section_order || []),
      "summary",
      "education",
      "skills",
      "work",
      "projects",
      "awards",
      ...(currentData.custom_sections || []).map((item: any) => item.id),
      ...(optimizedData.custom_sections || []).map((item: any) => item.id),
    ]),
  ].filter(Boolean)

  return order
    .filter((key) => hasSection(optimizedData, key))
    .map((key) => {
      const title = sectionTitle(optimizedData, key) || sectionTitle(currentData, key)
      return {
        key,
        title,
        changes: diffSection(key, sectionValue(currentData, key), sectionValue(optimizedData, key), title),
      }
    })
    .filter((section) => section.changes.length)
}
