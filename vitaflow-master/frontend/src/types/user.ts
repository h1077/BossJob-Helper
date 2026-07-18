export interface UserInfo {
  id: number
  username: string
  email: string
  avatar_url?: string
  role: "user" | "admin"
  status: "active" | "disabled"
  flow_points?: number
}
