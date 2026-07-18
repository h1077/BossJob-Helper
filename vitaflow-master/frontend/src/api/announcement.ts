import request from "./request"

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  published_at: string
}

export interface AnnouncementHistoryItem {
  id: number
  title: string
  summary: string
  published_at: string
}

export interface AnnouncementHistoryPage {
  items: AnnouncementHistoryItem[]
  total: number
  page: number
  page_size: number
}

export const getCurrentAnnouncementApi = () => request.get<AnnouncementItem | null, AnnouncementItem | null>("/announcements/current")
export const dismissAnnouncementApi = (id: number) => request.post(`/announcements/${id}/dismiss`)
export const getAnnouncementHistoryApi = (page = 1, pageSize = 10) => request.get<AnnouncementHistoryPage, AnnouncementHistoryPage>("/announcements", { params: { page, page_size: pageSize } })
export const getAnnouncementDetailApi = (id: number) => request.get<AnnouncementItem, AnnouncementItem>(`/announcements/${id}`)
