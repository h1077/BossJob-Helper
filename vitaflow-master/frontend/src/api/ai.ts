import request from "./request"

export const generateResumeApi = (data: any) => request.post("/ai/generate-resume", data)
export const scoreResumeApi = (data: any) => request.post("/ai/score-resume", data)
export const optimizeSectionApi = (data: any) => request.post("/ai/optimize-section", data)
export const optimizeByJdApi = (data: any) => request.post("/ai/optimize-by-jd", data)
export type AiChatAttachment = { url: string; name?: string; content_type?: string; object_name?: string }
export type AiChatModelOption = {
  id: number
  name: string
  supports_multimodal: boolean
  context_messages: number
  sort_order?: number
  points_per_call?: number | null
  points_per_million_input_tokens?: number | null
  points_per_million_output_tokens?: number | null
  uses_default_pricing?: boolean
}
export type AiCapability = {
  id?: number | null
  name: string
  supports_multimodal: boolean
  context_messages: number
  default_chat_model_id?: number | null
  chat_models?: AiChatModelOption[]
}
export type AiTokenUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated?: boolean
  calls?: Array<{ label?: string; input_tokens?: number; output_tokens?: number }>
}
export type AiRecord = {
  id: number
  task_type: string
  task_label: string
  status: string
  resume_id?: number
  resume_title?: string
  model_name?: string
  points_used: number
  tokens_used: number
  input_data?: Record<string, unknown> & { token_usage?: AiTokenUsage }
  output_data?: Record<string, unknown>
  error_message?: string
  create_time: string
  update_time: string
}
export type FlowPointSummary = {
  balance: number
  spent: number
  earned: number
  hint?: string
  rules: Array<{
    feature_type: string
    display_name: string
    points_per_call: number
    points_per_1k_tokens?: number
    points_per_million_tokens?: number
    points_per_million_input_tokens?: number
    points_per_million_output_tokens?: number
    enabled: boolean
  }>
}
export type FlowPointTransaction = { id: number; feature_type: string; points_delta: number; balance_after: number; tokens_used: number; model_name?: string | null; description: string; create_time: string }

export const getResumeChatMessagesApi = (resumeId: number) => request.get(`/ai/resume-chat/${resumeId}/messages`)
export const sendResumeChatMessageApi = (resumeId: number, data: { content: string; attachments?: AiChatAttachment[]; model_config_id?: number | null }) => request.post(`/ai/resume-chat/${resumeId}/messages`, data)
export const clearResumeChatMessagesApi = (resumeId: number) => request.delete(`/ai/resume-chat/${resumeId}/messages`)
export const decideResumeChatChangeApi = (resumeId: number, messageId: number, action: "apply" | "reject") =>
  request.post(`/ai/resume-chat/${resumeId}/messages/${messageId}/decision`, { action })
export const getAiCapabilityApi = () => request.get<AiCapability, AiCapability>("/ai/capability")
export const getMyAiRecordsApi = (params: Record<string, unknown>) => request.get<any, any>("/ai/records", { params })
export const getMyAiHistoriesApi = (params: Record<string, unknown>) => request.get<any, any>("/ai/histories", { params })
export const getFlowPointSummaryApi = () => request.get<FlowPointSummary, FlowPointSummary>("/ai/flow-points")
export const getFlowPointTransactionsApi = (params: Record<string, unknown>) => request.get<any, any>("/ai/flow-points/transactions", { params })
export const redeemFlowPointsApi = (code: string) => request.post<any, any>("/ai/flow-points/redeem", { code })

type StreamCallbacks<T = any> = {
  onConnected?: () => void
  onStart?: () => void
  onDelta?: (text: string) => void
  onPhase?: (phase: string, text: string) => void
  onResult?: (data: T) => void
}

import { showGlobalToast } from "@/utils/toast"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"

async function postAiStream<T = any>(path: string, data: any, callbacks: StreamCallbacks<T> = {}) {
  const token = localStorage.getItem("vitaflow_token")
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  })

  if (response.status === 401) {
    localStorage.removeItem("vitaflow_token")
    window.location.href = "/login"
    throw new Error("登录已过期，请重新登录")
  }
  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "")
    let message = raw
    if (raw) {
      try {
        const body = JSON.parse(raw)
        message = body?.message || body?.detail || body?.msg || raw
      } catch {
        message = raw
      }
    }
    throw new Error(message || "AI 请求失败")
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const raw = await response.text()
    try {
      const body = JSON.parse(raw)
      const msg = body?.message || body?.detail || body?.msg || "AI 请求失败"
      if (msg.includes("Flow Points") || msg.includes("点数")) {
        showGlobalToast(msg, "error")
        throw new Error("SILENT_ERROR")
      }
      throw new Error(msg)
    } catch (err: any) {
      if (err.message === "SILENT_ERROR") throw err
      if (err.message && !err.message.includes("JSON")) throw err
      throw new Error(raw || "AI 请求失败")
    }
  }

  callbacks.onConnected?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let finalResult: T | null = null

  const handleLine = (line: string) => {
    if (!line.trim()) return false
    const event = JSON.parse(line)
    if (event.type === "start") callbacks.onStart?.()
    if (event.type === "delta") callbacks.onDelta?.(String(event.text || ""))
    if (event.type === "phase") callbacks.onPhase?.(String(event.phase || ""), String(event.text || ""))
    if (event.type === "result") {
      finalResult = event.data as T
      callbacks.onResult?.(finalResult)
      return true
    }
    if (event.type === "error") throw new Error(event.message || "AI 生成失败")
    return false
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const line of lines) {
      if (handleLine(line)) {
        await reader.cancel().catch(() => null)
        return finalResult as T
      }
    }
  }
  buffer += decoder.decode()
  if (buffer.trim() && handleLine(buffer)) {
    await reader.cancel().catch(() => null)
    return finalResult as T
  }
  if (!finalResult) throw new Error("AI 未返回有效结果")
  return finalResult
}

export const generateResumeStreamApi = (data: any, callbacks?: StreamCallbacks) => postAiStream("/ai/generate-resume/stream", data, callbacks)
export const scoreResumeStreamApi = (data: any, callbacks?: StreamCallbacks) => postAiStream("/ai/score-resume/stream", data, callbacks)
export const optimizeSectionStreamApi = (data: any, callbacks?: StreamCallbacks) => postAiStream("/ai/optimize-section/stream", data, callbacks)
export const optimizeByJdStreamApi = (data: any, callbacks?: StreamCallbacks) => postAiStream("/ai/optimize-by-jd/stream", data, callbacks)
export const translateResumeStreamApi = (data: any, callbacks?: StreamCallbacks) => postAiStream("/ai/translate-resume/stream", data, callbacks)
export const sendResumeChatMessageStreamApi = (resumeId: number, data: { content: string; attachments?: AiChatAttachment[]; model_config_id?: number | null }, callbacks?: StreamCallbacks) =>
  postAiStream(`/ai/resume-chat/${resumeId}/messages/stream`, data, callbacks)
export const regenerateResumeChatMessageStreamApi = (
  resumeId: number,
  messageId: number,
  data: { content?: string; attachments?: AiChatAttachment[]; model_config_id?: number | null } = {},
  callbacks?: StreamCallbacks,
) =>
  postAiStream(`/ai/resume-chat/${resumeId}/messages/${messageId}/regenerate/stream`, data, callbacks)
