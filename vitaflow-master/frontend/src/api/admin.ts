import request from "./request"

export interface PageData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated?: boolean
  calls?: Array<{ label?: string; input_tokens?: number; output_tokens?: number }>
}

export interface DashboardData {
  totals: { users: number; resumes: number; ai_tasks: number; exports: number; storage_bytes: number; operating_days: number; launch_date?: string | null }
  today: { users: number; active_users: number; resumes: number; ai_tasks: number; exports: number }
  rates: { ai_success: number; export_success: number }
  tokens: { total: number; today: number; input: number; output: number; avg_per_task: number }
  points: { consumed: number; today_consumed: number; recharged: number }
  revenue?: { redeemed: number; today_redeemed: number }
  ai_breakdown: Array<{ task_type: string; total: number; success: number; failed: number; tokens: number; input_tokens: number; output_tokens: number }>
  model_breakdown?: Array<{ model_name: string; model_raw_name?: string; config_names?: string[]; total: number; tokens: number; input_tokens: number; output_tokens: number; points_used: number }>
  section_breakdown: Array<{ section_type: string; total: number; success: number; failed: number }>
  daily: Array<{ date: string; users: number; resumes: number; ai_tasks: number; exports: number; shares: number; tokens?: number; points_consumed?: number }>
  hourly_activity?: Array<{ hour: number; label: string; active_users: number; actions: number }>
}

export interface AdminUser {
  id: number
  username: string
  email: string
  avatar_url?: string
  role: "user" | "admin"
  status: "active" | "disabled"
  flow_points: number
  resume_count: number
  create_time: string
}

export interface AdminResume {
  id: number
  title: string
  user_id: number
  username: string
  email: string
  language: string
  template_id: string
  create_time: string
  update_time: string
}

export interface AdminAiTask {
  id: number
  user_id: number
  username: string
  resume_id?: number
  task_type: string
  status: string
  model_name?: string
  model_config_name?: string | null
  model_raw_name?: string | null
  points_used: number
  tokens_used: number
  error_message?: string
  input_data: {
    section_type?: string
    section_title?: string
    model?: string
    request_input_tokens?: number
    token_usage?: TokenUsage
  }
  output_data?: Record<string, unknown>
  create_time: string
  update_time: string
}

export interface AdminExport {
  id: number
  user_id: number
  username: string
  resume_id: number
  file_type: string
  file_name: string
  status: string
  error_message?: string
  create_time: string
}

export interface AdminTemplate {
  template_id: string
  name: string
  category: string
  is_pro: boolean
  is_visible: boolean
  sort_order: number
  usage_count: number
  preview_html?: string
}

export interface AdminIndustryTemplate {
  id?: number | null
  industry_id: string
  industry_name: string
  industry_description: string
  role_count: number
  default_template_id: string
  template_name: string
  template_category: string
  recommended_template_id: string
  is_active: boolean
  note?: string
  sort_order: number
  update_time?: string | null
}

export interface AdminResumeStarter {
  id: number
  starter_id: string
  industry_id: string
  industry_name: string
  industry_description: string
  role_title: string
  role_subtitle: string
  default_template_id: string
  template_name: string
  template_category: string
  keywords: string[]
  focus: string[]
  content: Record<string, any>
  sort_order: number
  is_visible: boolean
  create_time: string
  update_time: string
}

export interface AdminResumeStarterIndustry {
  id: string
  name: string
  description: string
}

export type AdminResumeStarterWrite = Omit<AdminResumeStarter, "id" | "template_name" | "template_category" | "create_time" | "update_time">

export interface AdminAnnouncement {
  id: number
  title: string
  content: string
  status: "draft" | "published"
  read_count: number
  created_by: number
  published_at?: string
  create_time: string
  update_time: string
}

export interface AdminAiConfig {
  id: number
  name: string
  provider: string
  base_url: string
  model: string
  temperature: number
  timeout: number
  max_tokens?: number | null
  supports_multimodal: boolean
  context_messages: number
  is_chat_selectable: boolean
  sort_order: number
  chat_points_per_call?: number | null
  chat_points_per_million_input_tokens?: number | null
  chat_points_per_million_output_tokens?: number | null
  is_active: boolean
  has_api_key: boolean
  create_time: string
  update_time: string
}

export interface AdminPointRule {
  id: number
  feature_type: string
  display_name: string
  points_per_call: number
  points_per_1k_tokens: number
  points_per_million_tokens: number
  points_per_million_input_tokens: number
  points_per_million_output_tokens: number
  enabled: boolean
}

export interface AdminRedeemCode {
  id: number
  code: string
  batch_no: string
  points: number
  price: number
  total_count: number
  used_count: number
  ip_once: boolean
  expire_time?: string
  status: "active" | "disabled"
  note?: string
  create_time: string
  update_time: string
}

export interface AdminSettings {
  signup_gift_points: string
  ai_records_hint: string
  feedback_notify_email: string
  redeem_daily_attempt_limit: string
  user_agreement: string
}

export interface AdminFlowPointTransaction {
  id: number
  user_id: number
  username: string
  email: string
  feature_type: string
  feature_name: string
  model_name?: string | null
  model_config_name?: string | null
  model_raw_name?: string | null
  points_delta: number
  balance_after: number
  tokens_used: number
  description: string
  grant_batch_no?: string | null
  can_revoke?: boolean
  task_id?: number | null
  direction: "consume" | "recharge"
  create_time: string
}

export interface AdminFeedback {
  id: number
  user_id: number
  username: string
  email: string
  category: string
  content: string
  contact?: string
  status: "open" | "processing" | "resolved" | "closed"
  admin_note?: string
  admin_reply?: string | null
  reply_time?: string | null
  create_time: string
  update_time: string
}

export const getAdminDashboardApi = () => request.get<DashboardData, DashboardData>("/admin/dashboard")
export const getAdminUsersApi = (params: Record<string, unknown>) => request.get<PageData<AdminUser>, PageData<AdminUser>>("/admin/users", { params })
export const updateAdminUserStatusApi = (id: number, status: "active" | "disabled") => request.patch(`/admin/users/${id}/status`, { status })
export const updateAdminUserFlowPointsApi = (id: number, data: { points_delta: number; description?: string }) => request.patch(`/admin/users/${id}/flow-points`, data)
export const grantAllUsersFlowPointsApi = (data: { points: number; description?: string; batch_size?: number }) => request.post("/admin/users/flow-points/grant-all", data)
export const revokeAllUsersFlowPointsGrantApi = (batchNo: string, data: { description?: string; batch_size?: number } = {}) => request.post(`/admin/users/flow-points/grant-all/${batchNo}/revoke`, data)
export const getAdminFlowPointTransactionsApi = (params: Record<string, unknown>) => request.get<PageData<AdminFlowPointTransaction>, PageData<AdminFlowPointTransaction>>("/admin/flow-point-transactions", { params })
export const getAdminResumesApi = (params: Record<string, unknown>) => request.get<PageData<AdminResume>, PageData<AdminResume>>("/admin/resumes", { params })
export const getAdminAiTasksApi = (params: Record<string, unknown>) => request.get<PageData<AdminAiTask>, PageData<AdminAiTask>>("/admin/ai-tasks", { params })
export const getAdminExportsApi = (params: Record<string, unknown>) => request.get<PageData<AdminExport>, PageData<AdminExport>>("/admin/exports", { params })
export const getAdminTemplatesApi = (params: Record<string, unknown>) => request.get<PageData<AdminTemplate>, PageData<AdminTemplate>>("/admin/templates", { params })
export const updateAdminTemplateApi = (templateId: string, data: { sort_order?: number; is_visible?: boolean }) =>
  request.patch<AdminTemplate, AdminTemplate>(`/admin/templates/${templateId}`, data)
export const getAdminIndustryTemplatesApi = (params: Record<string, unknown>) =>
  request.get<PageData<AdminIndustryTemplate>, PageData<AdminIndustryTemplate>>("/admin/resume-starter-industry-templates", { params })
export const updateAdminIndustryTemplateApi = (industryId: string, data: { default_template_id: string; note?: string }) =>
  request.put<AdminIndustryTemplate, AdminIndustryTemplate>(`/admin/resume-starter-industry-templates/${industryId}`, data)
export const deleteAdminIndustryTemplateApi = (industryId: string) => request.delete(`/admin/resume-starter-industry-templates/${industryId}`)
export const getAdminResumeStarterIndustriesApi = () => request.get<AdminResumeStarterIndustry[], AdminResumeStarterIndustry[]>("/admin/resume-starter-industries")
export const getAdminResumeStartersApi = (params: Record<string, unknown>) =>
  request.get<PageData<AdminResumeStarter>, PageData<AdminResumeStarter>>("/admin/resume-starters", { params })
export const createAdminResumeStarterApi = (data: Partial<AdminResumeStarterWrite>) =>
  request.post<AdminResumeStarter, AdminResumeStarter>("/admin/resume-starters", data)
export const updateAdminResumeStarterApi = (starterId: string, data: Partial<AdminResumeStarterWrite>) =>
  request.put<AdminResumeStarter, AdminResumeStarter>(`/admin/resume-starters/${starterId}`, data)
export const deleteAdminResumeStarterApi = (starterId: string) => request.delete(`/admin/resume-starters/${starterId}`)
export const getAdminAnnouncementsApi = (params: Record<string, unknown>) => request.get<PageData<AdminAnnouncement>, PageData<AdminAnnouncement>>("/admin/announcements", { params })
export const createAdminAnnouncementApi = (data: { title: string; content: string; status: "draft" | "published" }) => request.post<AdminAnnouncement, AdminAnnouncement>("/admin/announcements", data)
export const updateAdminAnnouncementApi = (id: number, data: { title: string; content: string; status: "draft" | "published" }) => request.put<AdminAnnouncement, AdminAnnouncement>(`/admin/announcements/${id}`, data)
export const updateAdminAnnouncementStatusApi = (id: number, status: "draft" | "published") => request.patch<AdminAnnouncement, AdminAnnouncement>(`/admin/announcements/${id}/status`, { status })
export const deleteAdminAnnouncementApi = (id: number) => request.delete(`/admin/announcements/${id}`)
export const getAdminAiConfigsApi = () => request.get<AdminAiConfig[], AdminAiConfig[]>("/admin/ai-configs")
export const createAdminAiConfigApi = (data: Partial<AdminAiConfig> & { api_key?: string }) => request.post<AdminAiConfig, AdminAiConfig>("/admin/ai-configs", data)
export const updateAdminAiConfigApi = (id: number, data: Partial<AdminAiConfig> & { api_key?: string }) => request.put<AdminAiConfig, AdminAiConfig>(`/admin/ai-configs/${id}`, data)
export const deleteAdminAiConfigApi = (id: number) => request.delete(`/admin/ai-configs/${id}`)
export const getAdminPointRulesApi = () => request.get<AdminPointRule[], AdminPointRule[]>("/admin/point-rules")
export const updateAdminPointRuleApi = (
  featureType: string,
  data: {
    display_name: string
    points_per_call: number
    points_per_million_tokens?: number
    points_per_million_input_tokens: number
    points_per_million_output_tokens: number
    enabled: boolean
  },
) =>
  request.put<AdminPointRule, AdminPointRule>(`/admin/point-rules/${featureType}`, data)
export const getAdminRedeemCodesApi = (params: Record<string, unknown>) => request.get<PageData<AdminRedeemCode>, PageData<AdminRedeemCode>>("/admin/redeem-codes", { params })
export const generateAdminRedeemCodesApi = (data: { count: number; points: number; price?: number; total_count: number; ip_once?: boolean; custom_codes?: string; expire_time?: string; note?: string }) =>
  request.post<AdminRedeemCode[], AdminRedeemCode[]>("/admin/redeem-codes", data)
export const updateAdminRedeemCodeStatusApi = (id: number, status: "active" | "disabled") => request.patch<AdminRedeemCode, AdminRedeemCode>(`/admin/redeem-codes/${id}/status`, { status })
export const updateAdminRedeemCodeApi = (
  id: number,
  data: Pick<AdminRedeemCode, "code" | "points" | "price" | "total_count" | "ip_once" | "status"> & { expire_time?: string | null; note?: string | null },
) => request.put<AdminRedeemCode, AdminRedeemCode>(`/admin/redeem-codes/${id}`, data)
export const deleteAdminRedeemCodeApi = (id: number) => request.delete(`/admin/redeem-codes/${id}`)
export const importAdminRedeemCodesApi = (data: { text: string; points: number; price?: number; total_count: number; ip_once?: boolean; expire_time?: string; note?: string }) =>
  request.post<AdminRedeemCode[], AdminRedeemCode[]>("/admin/redeem-codes/import", data)
export const updateAdminRedeemCodeBatchPriceApi = (data: { note?: string; batch_no?: string; price: number }) =>
  request.patch<{ note?: string; batch_no?: string; price: number; codes: number; redeemed: number }, { note?: string; batch_no?: string; price: number; codes: number; redeemed: number }>("/admin/redeem-codes/batch-price", data)
export const exportAdminRedeemCodesApi = (params: Record<string, unknown> = {}) =>
  request.get<string, string>("/admin/redeem-codes/export", { params, responseType: "text" } as any)
export const getAdminSettingsApi = () => request.get<AdminSettings, AdminSettings>("/admin/settings")
export const updateAdminSettingsApi = (data: { signup_gift_points: number; ai_records_hint: string; feedback_notify_email: string; redeem_daily_attempt_limit: number; user_agreement: string }) => request.put<AdminSettings, AdminSettings>("/admin/settings", data)
export const getAdminFeedbacksApi = (params: Record<string, unknown>) => request.get<PageData<AdminFeedback>, PageData<AdminFeedback>>("/admin/feedbacks", { params })
export const updateAdminFeedbackApi = (id: number, data: { status: AdminFeedback["status"]; admin_note?: string; admin_reply?: string }) =>
  request.patch(`/admin/feedbacks/${id}`, data)
export const sendAdminFeedbackEmailApi = (id: number, data: { status: AdminFeedback["status"]; admin_note?: string; admin_reply?: string }) =>
  request.post(`/admin/feedbacks/${id}/send-email`, data)
