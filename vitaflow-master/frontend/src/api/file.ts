import request from "./request"

export function uploadAvatarApi(file: File) {
  const form = new FormData()
  form.append("file", file)
  return request.post<any, { url: string; object_name: string }>("/files/upload-avatar", form)
}

export function uploadAnnouncementImageApi(file: File) {
  const form = new FormData()
  form.append("file", file)
  return request.post<any, { url: string; object_name: string }>("/files/upload-announcement-image", form)
}

export function uploadAiChatImageApi(file: File) {
  const form = new FormData()
  form.append("file", file)
  return request.post<any, { url: string; object_name: string; provider?: string }>("/files/upload-ai-chat-image", form)
}
