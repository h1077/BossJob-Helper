import { createRouter, createWebHistory } from "vue-router"
import Home from "@/views/Home.vue"
import Login from "@/views/Login.vue"
import ResumeList from "@/views/ResumeList.vue"
import ResumeEditor from "@/views/ResumeEditor.vue"
import TemplateGallery from "@/views/TemplateGallery.vue"
import Profile from "@/views/Profile.vue"
import HelpCenter from "@/views/HelpCenter.vue"
import { meApi } from "@/api/auth"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/login", component: Login },
    { path: "/register", component: Login }, // Merged with Login component
    { path: "/share/:token", component: () => import("@/views/SharedResume.vue") },
    { path: "/help", component: HelpCenter },
    { path: "/resumes", component: ResumeList },
    { path: "/resumes/:id/edit", component: ResumeEditor },
    { path: "/templates", component: TemplateGallery },
    { path: "/profile", component: Profile },
    { path: "/announcements", component: () => import("@/views/AnnouncementHistory.vue") },
    { path: "/ai-records", component: () => import("@/views/AiRecords.vue") },
    { path: "/admin", component: () => import("@/views/Admin.vue"), meta: { requiresAdmin: true } },
  ],
})

router.beforeEach(async (to) => {
  const publicPages = ["/", "/login", "/register", "/templates"]
  const token = localStorage.getItem("vitaflow_token")
  const isPublicShare = to.path.startsWith("/share/")
  if (!publicPages.includes(to.path) && !isPublicShare && !token) return "/login"
  if (to.meta.requiresAdmin) {
    try {
      const user = await meApi()
      if (user.role !== "admin") return "/resumes"
    } catch {
      return "/login"
    }
  }
})

export default router
