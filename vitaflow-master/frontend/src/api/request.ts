import axios from "axios"
import type { ApiResponse } from "@/types/api"

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  timeout: 30000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("vitaflow_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers["content-type"] || "")
    if (contentType.includes("application/pdf") || contentType.includes("wordprocessingml")) return response
    if (!contentType.includes("application/json")) return response.data
    const body = response.data as ApiResponse<unknown>
    if (body.code && body.code !== 200) throw new Error(body.message)
    return body.data
  },
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("vitaflow_token")
      window.location.href = "/login"
    }
    let message = error.response?.data?.message || error.message || "请求失败"
    const data = error.response?.data
    if (data instanceof Blob) {
      const text = await data.text().catch(() => "")
      if (text) {
        try {
          const body = JSON.parse(text)
          message = body?.message || body?.detail || message
        } catch {
          message = text || message
        }
      }
    }
    throw new Error(message)
  },
)

export default request
