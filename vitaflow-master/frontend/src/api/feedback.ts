import request from "./request"

export type FeedbackPayload = {
  category?: string
  content: string
  contact?: string
}

export interface FeedbackItem {
  id: number
  category: string
  content: string
  contact?: string | null
  status: "open" | "processing" | "resolved" | "closed"
  admin_reply?: string | null
  reply_time?: string | null
  create_time: string
  update_time: string
}

export interface FeedbackPageData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const submitFeedbackApi = (data: FeedbackPayload) => request.post("/feedback", data)
export const getMyFeedbacksApi = (params: Record<string, unknown>) =>
  request.get<FeedbackPageData<FeedbackItem>, FeedbackPageData<FeedbackItem>>("/feedback", { params })
