export interface PresetField {
  key: string
  label: string
  span?: 1 | 2
  type?: "text" | "rich" | "list"
  placeholder?: string
}

export interface ResumeModulePreset {
  type: string
  title: string
  group: string
  description: string
  fields: PresetField[]
  titleKeys: string[]
  subtitleKeys: string[]
  listKeys?: string[]
  richKey?: string
}

export interface BasicInfoPreset {
  key: string
  label: string
  icon: string
  placeholder: string
}

export const resumeModulePresets: ResumeModulePreset[] = [
  {
    type: "certifications",
    title: "证书/认证",
    group: "常用补充",
    description: "职业资格、专业认证、考试证书",
    titleKeys: ["name"],
    subtitleKeys: ["issuer", "date", "credential_id"],
    richKey: "description",
    fields: [
      { key: "name", label: "证书名称", placeholder: "例如：PMP 项目管理专业人士认证" },
      { key: "issuer", label: "颁发机构", placeholder: "例如：PMI" },
      { key: "date", label: "获得时间", placeholder: "例如：2024-06" },
      { key: "credential_id", label: "证书编号", placeholder: "可选" },
      { key: "url", label: "证书链接", span: 2, placeholder: "可选" },
      { key: "description", label: "说明", type: "rich", span: 2, placeholder: "补充认证方向、适用领域或成绩" },
    ],
  },
  {
    type: "languages",
    title: "语言能力",
    group: "常用补充",
    description: "外语水平、考试成绩、工作语言",
    titleKeys: ["name"],
    subtitleKeys: ["level", "score"],
    richKey: "description",
    fields: [
      { key: "name", label: "语言", placeholder: "例如：英语" },
      { key: "level", label: "水平", placeholder: "例如：CET-6 / 商务沟通" },
      { key: "score", label: "成绩", placeholder: "例如：560" },
      { key: "description", label: "说明", type: "rich", span: 2, placeholder: "补充听说读写、工作场景或考试信息" },
    ],
  },
  {
    type: "training",
    title: "培训经历",
    group: "常用补充",
    description: "职业课程、训练营、专项培训",
    titleKeys: ["name"],
    subtitleKeys: ["institution", "start_date", "end_date"],
    richKey: "description",
    fields: [
      { key: "name", label: "课程/培训名称" },
      { key: "institution", label: "机构" },
      { key: "start_date", label: "开始时间" },
      { key: "end_date", label: "结束时间" },
      { key: "description", label: "学习内容", type: "rich", span: 2 },
    ],
  },
  {
    type: "internships",
    title: "实习经历",
    group: "学生求职",
    description: "单独展示实习公司、岗位与成果",
    titleKeys: ["company"],
    subtitleKeys: ["position", "start_date", "end_date"],
    richKey: "description",
    listKeys: ["highlights"],
    fields: [
      { key: "company", label: "公司/组织" },
      { key: "position", label: "岗位" },
      { key: "start_date", label: "开始时间" },
      { key: "end_date", label: "结束时间" },
      { key: "description", label: "工作内容", type: "rich", span: 2 },
      { key: "highlights", label: "成果亮点", type: "list", span: 2 },
    ],
  },
  {
    type: "campus",
    title: "校园经历",
    group: "学生求职",
    description: "学生组织、社团、班委、校内项目",
    titleKeys: ["organization"],
    subtitleKeys: ["role", "start_date", "end_date"],
    richKey: "description",
    listKeys: ["highlights"],
    fields: [
      { key: "organization", label: "组织/社团" },
      { key: "role", label: "角色" },
      { key: "start_date", label: "开始时间" },
      { key: "end_date", label: "结束时间" },
      { key: "description", label: "经历说明", type: "rich", span: 2 },
      { key: "highlights", label: "成果亮点", type: "list", span: 2 },
    ],
  },
  {
    type: "competitions",
    title: "竞赛经历",
    group: "学生求职",
    description: "学科竞赛、商业竞赛、设计/算法比赛",
    titleKeys: ["name"],
    subtitleKeys: ["award", "date", "role"],
    richKey: "description",
    fields: [
      { key: "name", label: "比赛名称" },
      { key: "award", label: "奖项/等级" },
      { key: "date", label: "时间" },
      { key: "role", label: "角色" },
      { key: "description", label: "作品/贡献说明", type: "rich", span: 2 },
    ],
  },
  {
    type: "social_practice",
    title: "社会实践",
    group: "学生求职",
    description: "志愿服务、调研实践、公益项目",
    titleKeys: ["organization"],
    subtitleKeys: ["role", "start_date", "end_date"],
    richKey: "description",
    fields: [
      { key: "organization", label: "组织/项目" },
      { key: "role", label: "角色" },
      { key: "start_date", label: "开始时间" },
      { key: "end_date", label: "结束时间" },
      { key: "description", label: "实践内容", type: "rich", span: 2 },
    ],
  },
  {
    type: "open_source",
    title: "开源贡献",
    group: "技术岗位",
    description: "GitHub 项目、PR、Issue、社区贡献",
    titleKeys: ["name"],
    subtitleKeys: ["role", "url"],
    richKey: "description",
    listKeys: ["highlights"],
    fields: [
      { key: "name", label: "项目名称" },
      { key: "role", label: "贡献角色" },
      { key: "url", label: "仓库链接", span: 2 },
      { key: "tech_stack", label: "技术栈", span: 2 },
      { key: "description", label: "贡献说明", type: "rich", span: 2 },
      { key: "highlights", label: "贡献亮点", type: "list", span: 2 },
    ],
  },
  {
    type: "tech_blog",
    title: "技术博客",
    group: "技术岗位",
    description: "技术文章、专栏、知识沉淀",
    titleKeys: ["title"],
    subtitleKeys: ["platform", "date", "url"],
    richKey: "description",
    fields: [
      { key: "title", label: "文章/专栏标题" },
      { key: "platform", label: "平台" },
      { key: "date", label: "时间" },
      { key: "url", label: "链接" },
      { key: "description", label: "内容说明", type: "rich", span: 2 },
    ],
  },
  {
    type: "publications",
    title: "论文/专利",
    group: "技术岗位",
    description: "论文、专利、出版物、研究成果",
    titleKeys: ["title"],
    subtitleKeys: ["publisher", "date", "role"],
    richKey: "description",
    fields: [
      { key: "title", label: "标题" },
      { key: "publisher", label: "期刊/专利号/会议" },
      { key: "date", label: "时间" },
      { key: "role", label: "作者/角色" },
      { key: "url", label: "链接", span: 2 },
      { key: "description", label: "说明", type: "rich", span: 2 },
    ],
  },
  {
    type: "portfolio",
    title: "作品集",
    group: "作品展示",
    description: "设计、产品、前端、内容类作品",
    titleKeys: ["name"],
    subtitleKeys: ["role", "url"],
    richKey: "description",
    listKeys: ["highlights"],
    fields: [
      { key: "name", label: "作品名称" },
      { key: "role", label: "角色" },
      { key: "url", label: "作品链接", span: 2 },
      { key: "tech_stack", label: "工具/技术", span: 2 },
      { key: "description", label: "作品说明", type: "rich", span: 2 },
      { key: "highlights", label: "亮点", type: "list", span: 2 },
    ],
  },
  {
    type: "case_studies",
    title: "案例展示",
    group: "作品展示",
    description: "运营案例、产品案例、咨询案例",
    titleKeys: ["name"],
    subtitleKeys: ["role", "url"],
    richKey: "description",
    listKeys: ["highlights"],
    fields: [
      { key: "name", label: "案例名称" },
      { key: "role", label: "角色" },
      { key: "url", label: "链接", span: 2 },
      { key: "description", label: "案例说明", type: "rich", span: 2 },
      { key: "highlights", label: "关键成果", type: "list", span: 2 },
    ],
  },
]

export const basicInfoPresets: BasicInfoPreset[] = [
  { key: "wechat", label: "微信", icon: "MessageCircle", placeholder: "请输入微信号" },
  { key: "linkedin", label: "LinkedIn", icon: "Linkedin", placeholder: "请输入 LinkedIn 链接" },
  { key: "blog", label: "个人博客", icon: "BookOpen", placeholder: "请输入博客链接" },
  { key: "portfolio", label: "作品集链接", icon: "Images", placeholder: "请输入作品集链接" },
  { key: "availability", label: "到岗时间", icon: "CalendarCheck", placeholder: "例如：两周内" },
  { key: "years_experience", label: "工作年限", icon: "Briefcase", placeholder: "例如：3 年" },
  { key: "expected_city", label: "期望城市", icon: "MapPin", placeholder: "例如：上海 / 远程" },
  { key: "job_type", label: "求职类型", icon: "Tag", placeholder: "例如：全职 / 实习 / 远程" },
  { key: "political_status", label: "政治面貌", icon: "IdCard", placeholder: "可选" },
  { key: "driver_license", label: "驾驶证", icon: "Car", placeholder: "例如：C1" },
  { key: "english_level", label: "英语水平", icon: "Languages", placeholder: "例如：CET-6 560" },
  { key: "other_languages", label: "其他语言", icon: "Languages", placeholder: "例如：日语 N2" },
]

export function modulePresetByType(type?: string) {
  return resumeModulePresets.find((item) => item.type === type)
}

export function modulePresetGroups() {
  const groups: Record<string, ResumeModulePreset[]> = {}
  resumeModulePresets.forEach((preset) => {
    groups[preset.group] ||= []
    groups[preset.group].push(preset)
  })
  return groups
}

export function createPresetSection(type?: string) {
  const preset = modulePresetByType(type)
  const now = Date.now()
  if (!preset) {
    return {
      id: `custom_${now}`,
      title: "自定义模块",
      items: [{ id: `item_${now}`, title: "", content: "" }],
    }
  }
  return {
    id: `custom_${preset.type}_${now}`,
    preset_type: preset.type,
    title: preset.title,
    items: [createPresetItem(preset.type)],
  }
}

export function createPresetItem(type?: string) {
  const preset = modulePresetByType(type)
  const item: Record<string, any> = { id: `item_${Date.now()}` }
  if (!preset) return { ...item, title: "", content: "" }
  preset.fields.forEach((field) => {
    item[field.key] = field.type === "list" ? [] : ""
  })
  return item
}

export function presetItemTitle(preset: ResumeModulePreset | undefined, item: any, fallback = "新条目") {
  if (!preset) return item?.title || fallback
  for (const key of preset.titleKeys) {
    const value = String(item?.[key] || "").trim()
    if (value) return value
  }
  return fallback
}

export function presetItemSubtitle(preset: ResumeModulePreset | undefined, item: any) {
  if (!preset) return item?.content ? "已填写内容" : "完善信息"
  const values = preset.subtitleKeys
    .map((key) => String(item?.[key] || "").trim())
    .filter(Boolean)
  return values.join(" | ") || "完善信息"
}
