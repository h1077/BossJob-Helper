import { defineStore } from "pinia"
import { loginApi, meApi } from "@/api/auth"
import type { UserInfo } from "@/types/user"

export const useUserStore = defineStore("user", {
  state: () => ({
    token: localStorage.getItem("vitaflow_token") || "",
    userInfo: null as UserInfo | null,
  }),
  actions: {
    async login(email: string, password: string) {
      const data = await loginApi({ email, password })
      this.token = data.access_token
      this.userInfo = data.user
      localStorage.setItem("vitaflow_token", data.access_token)
    },
    logout() {
      this.token = ""
      this.userInfo = null
      localStorage.removeItem("vitaflow_token")
    },
    async getUserInfo() {
      this.userInfo = await meApi()
    },
  },
})
