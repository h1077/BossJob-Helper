<script setup lang="ts">
import { RouterLink, useRouter, useRoute } from "vue-router"
import { computed, onMounted, ref } from "vue"
import { Bell, CircleHelp, LayoutDashboard, LayoutTemplate, Files, LogOut, Sparkles, UserRound, Menu, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import BrandLogo from "@/components/common/BrandLogo.vue"
import FlowPointIcon from "@/components/ui/FlowPointIcon.vue"
import { useUserStore } from "@/stores/user"

const user = useUserStore()
const router = useRouter()
const route = useRoute()
const loggedIn = computed(() => Boolean(user.token))
const mobileMenuOpen = ref(false)

onMounted(() => {
  if (user.token && !user.userInfo) user.getUserInfo().catch(() => user.logout())
})

function logout() {
  mobileMenuOpen.value = false
  user.logout()
  router.push("/")
}
</script>

<template>
  <div class="min-h-screen bg-zinc-50/50">
    <header class="sticky top-0 z-20 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <RouterLink to="/" class="inline-flex items-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500" @click="mobileMenuOpen = false">
          <BrandLogo />
        </RouterLink>
        
        <!-- Desktop Navigation -->
        <nav class="hidden sm:flex items-center gap-2 text-sm font-medium text-zinc-600">
          <RouterLink 
            class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/templates' }"
            to="/templates"
          >
            <LayoutTemplate class="h-4 w-4" />
            <span>模板中心</span>
          </RouterLink>
          <RouterLink
            v-if="loggedIn"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/help' }"
            to="/help"
          >
            <CircleHelp class="h-4 w-4" />
            <span>帮助</span>
          </RouterLink>
          
          <template v-if="loggedIn">
            <RouterLink
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/announcements' }"
              to="/announcements"
            >
              <Bell class="h-4 w-4" />
              <span>公告</span>
            </RouterLink>
            <RouterLink
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/ai-records' }"
              to="/ai-records"
            >
              <FlowPointIcon class="h-4 w-4" />
              <span>Flow Points</span>
            </RouterLink>
            <RouterLink
              v-if="user.userInfo?.role === 'admin'"
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path.startsWith('/admin') }"
              to="/admin"
            >
              <LayoutDashboard class="h-4 w-4" />
              <span>管理后台</span>
            </RouterLink>
            <RouterLink 
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/resumes' }"
              to="/resumes"
            >
              <Files class="h-4 w-4" />
              <span>我的简历</span>
            </RouterLink>
            <RouterLink
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/profile' }"
              to="/profile"
            >
              <UserRound class="h-4 w-4" />
              <span>{{ user.userInfo?.username || '用户信息' }}</span>
            </RouterLink>
            <button 
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
              @click="logout"
            >
              <LogOut class="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </template>
          
          <template v-else>
            <RouterLink to="/resumes" class="ml-2 shrink-0">
              <Button size="sm" class="h-9 px-4 bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-sm rounded-lg shrink-0">
                <Sparkles class="h-4 w-4 mr-1.5 shrink-0" />
                <span class="whitespace-nowrap">开始使用</span>
              </Button>
            </RouterLink>
          </template>
        </nav>

        <!-- Mobile Navigation Trigger & Shortcuts -->
        <div class="flex sm:hidden items-center gap-1.5">
          <template v-if="!loggedIn">
            <RouterLink 
              class="flex shrink-0 items-center gap-1.5 rounded-md p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium"
              :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/templates' }"
              to="/templates"
            >
              <LayoutTemplate class="h-4 w-4" />
              <span>模板</span>
            </RouterLink>
            <RouterLink to="/resumes" class="shrink-0">
              <Button size="sm" class="h-8 px-2 min-[420px]:px-3 bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-sm rounded-lg text-xs shrink-0" title="开始使用">
                <Sparkles class="h-3.5 w-3.5 shrink-0 min-[420px]:mr-1" />
                <span class="hidden whitespace-nowrap min-[420px]:inline">开始使用</span>
              </Button>
            </RouterLink>
          </template>
          <template v-else>
            <!-- Quick access to My Resumes on mobile -->
            <RouterLink 
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-zinc-200 transition-colors mr-1"
              to="/resumes"
              @click="mobileMenuOpen = false"
            >
              <Files class="h-3.5 w-3.5" />
              <span>我的简历</span>
            </RouterLink>
            <!-- Hamburger button -->
            <button 
              @click="mobileMenuOpen = !mobileMenuOpen" 
              class="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus:outline-none transition-colors"
              aria-label="Toggle Menu"
            >
              <Menu v-if="!mobileMenuOpen" class="h-6 w-6" />
              <X v-else class="h-6 w-6" />
            </button>
          </template>
        </div>
      </div>

      <!-- Mobile Dropdown Menu (Logged In) -->
      <Transition name="mobile-menu">
        <div v-if="loggedIn && mobileMenuOpen" class="sm:hidden absolute top-full left-0 right-0 border-b border-zinc-200/80 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-1 shadow-2xl z-50">
          <RouterLink 
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/templates' }"
            to="/templates"
            @click="mobileMenuOpen = false"
          >
            <LayoutTemplate class="h-4 w-4 text-zinc-500" />
            <span>模板中心</span>
          </RouterLink>
          <RouterLink
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/help' }"
            to="/help"
            @click="mobileMenuOpen = false"
          >
            <CircleHelp class="h-4 w-4 text-zinc-500" />
            <span>帮助中心</span>
          </RouterLink>
          <RouterLink
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/announcements' }"
            to="/announcements"
            @click="mobileMenuOpen = false"
          >
            <Bell class="h-4 w-4 text-zinc-500" />
            <span>公告</span>
          </RouterLink>
          <RouterLink
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/ai-records' }"
            to="/ai-records"
            @click="mobileMenuOpen = false"
          >
            <FlowPointIcon class="h-4 w-4 text-zinc-500" />
            <span>Flow Points</span>
          </RouterLink>
          <RouterLink
            v-if="user.userInfo?.role === 'admin'"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path.startsWith('/admin') }"
            to="/admin"
            @click="mobileMenuOpen = false"
          >
            <LayoutDashboard class="h-4 w-4 text-zinc-500" />
            <span>管理后台</span>
          </RouterLink>
          <RouterLink 
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/resumes' }"
            to="/resumes"
            @click="mobileMenuOpen = false"
          >
            <Files class="h-4 w-4 text-zinc-500" />
            <span>我的简历</span>
          </RouterLink>
          <RouterLink
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            :class="{ 'bg-zinc-100 text-zinc-900': route.path === '/profile' }"
            to="/profile"
            @click="mobileMenuOpen = false"
          >
            <UserRound class="h-4 w-4 text-zinc-500" />
            <span>{{ user.userInfo?.username || '用户信息' }}</span>
          </RouterLink>
          <button 
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            @click="logout"
          >
            <LogOut class="h-4 w-4" />
            <span>退出登录</span>
          </button>
        </div>
      </Transition>
    </header>
    <slot />
  </div>
</template>

<style scoped>
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
