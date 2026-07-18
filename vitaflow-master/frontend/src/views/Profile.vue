<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import DOMPurify from "dompurify"
import { useRoute } from "vue-router"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import Label from "@/components/ui/label/Label.vue"
import Select from "@/components/ui/select/Select.vue"
import RichTextEditor from "@/components/admin/RichTextEditor.vue"
import { changePasswordApi, updateProfileApi } from "@/api/auth"
import { getMyFeedbacksApi, submitFeedbackApi, type FeedbackItem, type FeedbackPageData } from "@/api/feedback"
import { useUserStore } from "@/stores/user"
import { Inbox, Loader2, Lock, MessageSquare, RefreshCw, Send, ShieldCheck, User, X } from "lucide-vue-next"
import { showGlobalToast } from "@/utils/toast"

const user = useUserStore()
const route = useRoute()
const username = ref("")
const profileSaving = ref(false)

const passwordForm = ref({ current_password: "", new_password: "", confirm_password: "" })
const passwordSaving = ref(false)

const activeTab = ref<"profile" | "password" | "feedback">((route.query.tab as any) || "profile")

const categoryOptions = [
  { label: "简历编辑", value: "简历编辑" },
  { label: "AI 智能生成", value: "AI 智能生成" },
  { label: "导入解析", value: "导入解析" },
  { label: "模板与导出", value: "模板与导出" },
  { label: "账号与设置", value: "账号与设置" },
  { label: "其他意见", value: "其他意见" },
]
const feedbackCategory = ref("简历编辑")
const feedbackContent = ref("")
const feedbackContact = ref("")
const feedbackSubmitting = ref(false)
const feedbacksLoading = ref(false)
const feedbackView = ref<"submit" | "history">("submit")
const myFeedbacks = ref<FeedbackPageData<FeedbackItem>>({ items: [], total: 0, page: 1, page_size: 10 })
const feedbackDialog = ref<"preview" | "reply" | null>(null)
const selectedFeedback = ref<FeedbackItem | null>(null)

function sanitizeFeedbackHtml(content?: string | null) {
  return DOMPurify.sanitize(content || "")
}

onMounted(async () => {
  if (!user.userInfo) await user.getUserInfo()
  username.value = user.userInfo?.username || ""
  await loadMyFeedbacks()
})

watch(activeTab, (value) => {
  if (value === "feedback") loadMyFeedbacks()
})

watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab as any
  }
})

async function saveProfile() {
  try {
    profileSaving.value = true
    user.userInfo = await updateProfileApi({ username: username.value })
    showGlobalToast("用户名已成功更新", "success")
  } catch (e: any) {
    showGlobalToast(e.message || "更新失败，请重试", "error")
  } finally {
    profileSaving.value = false
  }
}

async function savePassword() {
  try {
    passwordSaving.value = true
    if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
      throw new Error("两次输入的新密码不一致")
    }
    if (passwordForm.value.new_password.length < 6) {
      throw new Error("新密码长度不能少于6位")
    }
    await changePasswordApi({
      current_password: passwordForm.value.current_password,
      new_password: passwordForm.value.new_password,
    })
    passwordForm.value = { current_password: "", new_password: "", confirm_password: "" }
    showGlobalToast("密码已成功修改", "success")
  } catch (e: any) {
    showGlobalToast(e.message || "修改密码失败，请核对当前密码", "error")
  } finally {
    passwordSaving.value = false
  }
}

async function submitFeedback() {
  const content = feedbackContent.value.trim()
  if (!content || feedbackSubmitting.value) return
  feedbackSubmitting.value = true
  try {
    await submitFeedbackApi({
      category: feedbackCategory.value,
      content,
      contact: feedbackContact.value.trim() || undefined,
    })
    showGlobalToast("反馈已提交，我们会尽快处理。", "success")
    feedbackContent.value = ""
    feedbackContact.value = ""
    await loadMyFeedbacks(1)
    feedbackView.value = "history"
  } catch (err: any) {
    showGlobalToast(err.message || "反馈提交失败", "error")
  } finally {
    feedbackSubmitting.value = false
  }
}

async function loadMyFeedbacks(page = 1) {
  feedbacksLoading.value = true
  try {
    myFeedbacks.value = await getMyFeedbacksApi({ page, page_size: myFeedbacks.value.page_size })
  } catch (err: any) {
    showGlobalToast(err.message || "反馈列表加载失败", "error")
  } finally {
    feedbacksLoading.value = false
  }
}

function formatDate(value?: string | null) {
  if (!value) return ""
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function feedbackStatusText(value: FeedbackItem["status"]) {
  return ({ open: "待处理", processing: "处理中", resolved: "已解决", closed: "已关闭" } as Record<string, string>)[value] || value
}

function feedbackStatusClass(value: FeedbackItem["status"]) {
  if (value === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  if (value === "closed") return "bg-zinc-100 text-zinc-600 ring-zinc-500/20"
  if (value === "processing") return "bg-blue-50 text-blue-700 ring-blue-600/20"
  return "bg-amber-50 text-amber-700 ring-amber-600/20"
}

function openFeedbackDialog(item: FeedbackItem, type: "preview" | "reply") {
  selectedFeedback.value = item
  feedbackDialog.value = type
}

function closeFeedbackDialog() {
  feedbackDialog.value = null
  selectedFeedback.value = null
}

const navItems = [
  { id: "profile" as const, label: "基本信息", icon: User },
  { id: "password" as const, label: "修改密码", icon: Lock },
  { id: "feedback" as const, label: "意见反馈", icon: MessageSquare },
]
</script>

<template>
  <AppLayout>
    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      
      <!-- Page Header -->
      <header class="mb-7">
        <p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">User Center</p>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">个人中心</h1>
        <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500">管理你的个人账号信息与偏好设置</p>
      </header>

      <!-- Main Layout Grid -->
      <div class="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
        
        <!-- Left Sidebar: Unified Minimal Card (User Info + Navigation) -->
        <aside class="space-y-4">
          <div class="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <!-- User Info Header -->
            <div class="flex items-center justify-between pb-5 mb-5 border-b border-zinc-100 px-2">
              <div class="min-w-0 flex-1 pr-2">
                <p class="text-base font-semibold text-zinc-900 truncate">{{ username || 'Vita User' }}</p>
                <p class="text-xs text-zinc-400 mt-0.5 truncate">{{ user.userInfo?.email }}</p>
              </div>
              <span class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium">
                <ShieldCheck class="w-3.5 h-3.5 text-zinc-600" />
                <span>{{ user.userInfo?.role === 'admin' ? '管理员' : '用户' }}</span>
              </span>
            </div>

            <!-- Desktop Navigation Menu -->
            <nav class="hidden lg:space-y-1.5 lg:block">
              <button 
                v-for="item in navItems" 
                :key="item.id"
                @click="activeTab = item.id"
                class="flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-all duration-200"
                :class="activeTab === item.id ? 'bg-zinc-900 text-white font-semibold shadow-md shadow-zinc-900/10' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'"
              >
                <component :is="item.icon" class="h-4.5 w-4.5" />
                <span>{{ item.label }}</span>
              </button>
            </nav>

            <!-- Mobile Navigation Menu -->
            <div class="flex gap-2 overflow-x-auto lg:hidden pb-1">
              <button 
                v-for="item in navItems" 
                :key="item.id"
                @click="activeTab = item.id"
                class="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200"
                :class="activeTab === item.id ? 'bg-zinc-900 text-white font-semibold shadow-md shadow-zinc-900/10' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'"
              >
                <component :is="item.icon" class="h-4 w-4" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>
        </aside>

        <!-- Right Main Content Area -->
        <section class="rounded-[2rem] bg-white p-6 sm:p-10 shadow-sm ring-1 ring-zinc-100 lg:min-h-[480px] flex flex-col justify-between">
          
          <!-- Tab 1: Profile Settings -->
          <div v-if="activeTab === 'profile'" class="space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <div class="border-b border-zinc-100 pb-4 mb-6">
                <h2 class="text-lg font-semibold text-zinc-900 tracking-tight">基本信息</h2>
              </div>

              <div class="space-y-6 max-w-2xl">
                <div class="space-y-2">
                  <Label class="text-zinc-700 text-xs font-medium">登录邮箱</Label>
                  <Input :model-value="user.userInfo?.email || ''" disabled class="bg-zinc-50 border-zinc-200 text-zinc-500 h-11 w-full rounded-xl shadow-sm" />
                </div>

                <div class="space-y-2">
                  <Label class="text-zinc-700 text-xs font-medium">用户名</Label>
                  <Input v-model="username" maxlength="50" placeholder="请输入用户名" class="border-zinc-200 focus-visible:ring-zinc-900 transition-all h-11 w-full rounded-xl shadow-sm" />
                </div>
              </div>
            </div>

            <div class="pt-6 border-t border-zinc-100 flex justify-end">
              <Button @click="saveProfile" :disabled="profileSaving" class="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95">
                <Loader2 v-if="profileSaving" class="mr-2 h-4 w-4 animate-spin" />
                <span>保存更改</span>
              </Button>
            </div>
          </div>

          <!-- Tab 2: Password Settings -->
          <div v-else-if="activeTab === 'password'" class="space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <div class="border-b border-zinc-100 pb-4 mb-6">
                <h2 class="text-lg font-semibold text-zinc-900 tracking-tight">修改密码</h2>
              </div>

              <div class="space-y-6 max-w-2xl">
                <div class="space-y-2">
                  <Label class="text-zinc-700 text-xs font-medium">当前密码</Label>
                  <Input v-model="passwordForm.current_password" type="password" placeholder="当前密码" class="border-zinc-200 focus-visible:ring-zinc-900 transition-all h-11 w-full rounded-xl shadow-sm" />
                </div>
                <div class="space-y-2">
                  <Label class="text-zinc-700 text-xs font-medium">新密码</Label>
                  <Input v-model="passwordForm.new_password" type="password" placeholder="至少 6 位新密码" class="border-zinc-200 focus-visible:ring-zinc-900 transition-all h-11 w-full rounded-xl shadow-sm" />
                </div>
                <div class="space-y-2">
                  <Label class="text-zinc-700 text-xs font-medium">确认新密码</Label>
                  <Input v-model="passwordForm.confirm_password" type="password" placeholder="再次输入新密码" class="border-zinc-200 focus-visible:ring-zinc-900 transition-all h-11 w-full rounded-xl shadow-sm" @keyup.enter="savePassword" />
                </div>
              </div>
            </div>

            <div class="pt-6 border-t border-zinc-100 flex justify-end">
              <Button @click="savePassword" :disabled="passwordSaving" class="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95">
                <Loader2 v-if="passwordSaving" class="mr-2 h-4 w-4 animate-spin" />
                <span>更新密码</span>
              </Button>
            </div>
          </div>

          <!-- Tab 3: Feedback -->
          <div v-else-if="activeTab === 'feedback'" class="flex flex-1 flex-col">
            <div class="mb-6 flex flex-col gap-4 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-lg font-semibold tracking-tight text-zinc-900">意见反馈</h2>
              <div class="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-xs font-medium text-zinc-500 sm:w-56">
                <button
                  class="rounded-lg px-3 py-2 transition"
                  :class="feedbackView === 'submit' ? 'bg-white text-zinc-900 shadow-sm' : 'hover:text-zinc-900'"
                  @click="feedbackView = 'submit'"
                >
                  提交反馈
                </button>
                <button
                  class="rounded-lg px-3 py-2 transition"
                  :class="feedbackView === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'hover:text-zinc-900'"
                  @click="feedbackView = 'history'; loadMyFeedbacks(myFeedbacks.page)"
                >
                  反馈历史
                </button>
              </div>
            </div>

            <div v-if="feedbackView === 'submit'" class="flex flex-1 flex-col justify-between">
              <div class="space-y-6 max-w-3xl">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                  <div class="space-y-2">
                    <Label class="text-xs font-medium text-zinc-700">所属模块</Label>
                    <Select v-model="feedbackCategory" :options="categoryOptions" class="h-11 w-full rounded-xl border-zinc-200 shadow-sm transition-all focus:border-zinc-900 focus:ring-zinc-900" />
                  </div>
                  <div class="space-y-2">
                    <Label class="text-xs font-medium text-zinc-700">联系方式 (可选)</Label>
                    <Input v-model="feedbackContact" placeholder="手机号、微信或邮箱" class="h-11 w-full rounded-xl border-zinc-200 shadow-sm transition-all focus-visible:ring-zinc-900" />
                  </div>
                </div>
                <div class="space-y-2">
                  <Label class="text-xs font-medium text-zinc-700">反馈内容</Label>
                  <RichTextEditor v-model="feedbackContent" placeholder="写下您遇到的问题或建议 (支持插入图片)..." upload-type="user" compact />
                </div>
              </div>

              <div class="mt-8 flex justify-end border-t border-zinc-100 pt-6">
                <Button @click="submitFeedback" :disabled="feedbackSubmitting || !feedbackContent.trim()" class="h-11 rounded-xl bg-zinc-900 px-8 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  <Loader2 v-if="feedbackSubmitting" class="mr-2 h-4 w-4 animate-spin" />
                  <Send v-else class="mr-2 h-4 w-4" />
                  <span>提交反馈</span>
                </Button>
              </div>
            </div>

            <div v-else class="flex flex-1 flex-col">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-zinc-900">反馈历史</h3>
                  <p class="mt-1 text-xs text-zinc-400">共 {{ myFeedbacks.total }} 条记录</p>
                </div>
                <button class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50" @click="loadMyFeedbacks(myFeedbacks.page)">
                  <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': feedbacksLoading }" />
                  刷新
                </button>
              </div>

              <div v-if="feedbacksLoading && !myFeedbacks.items.length" class="flex h-48 items-center justify-center rounded-xl border border-zinc-100 text-sm text-zinc-400">
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                正在加载
              </div>

              <div v-else-if="!myFeedbacks.items.length" class="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 text-sm text-zinc-400">
                <Inbox class="mb-2 h-5 w-5" />
                暂无反馈记录
              </div>

              <div v-else class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <ul class="divide-y divide-zinc-100">
                  <li v-for="item in myFeedbacks.items" :key="item.id" class="bg-white px-4 py-4 transition hover:bg-zinc-50/50 sm:px-5">
                    <div class="flex flex-col">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="truncate text-sm font-semibold text-zinc-900">{{ item.category || '意见反馈' }}</span>
                        <span class="rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="feedbackStatusClass(item.status)">{{ feedbackStatusText(item.status) }}</span>
                        <span v-if="item.admin_reply" class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已回复</span>
                      </div>
                      <div class="mt-3.5 flex items-center justify-between gap-3 pt-3 border-t border-zinc-100/80">
                        <span class="text-xs text-zinc-400 font-medium shrink-0">{{ formatDate(item.create_time) }}</span>
                        <div class="flex items-center gap-2 shrink-0">
                          <button class="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95 whitespace-nowrap shrink-0" @click="openFeedbackDialog(item, 'preview')">预览</button>
                          <button
                            class="h-8 rounded-lg border px-3 text-xs font-medium shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none whitespace-nowrap shrink-0"
                            :class="item.admin_reply ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-zinc-200 bg-zinc-50 text-zinc-400'"
                            :disabled="!item.admin_reply"
                            @click="openFeedbackDialog(item, 'reply')"
                          >
                            查看回复
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              <div v-if="myFeedbacks.total > myFeedbacks.page_size" class="mt-4 flex items-center justify-end gap-2">
                <button class="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40" :disabled="myFeedbacks.page <= 1 || feedbacksLoading" @click="loadMyFeedbacks(myFeedbacks.page - 1)">上一页</button>
                <span class="text-xs text-zinc-400">{{ myFeedbacks.page }} / {{ Math.max(1, Math.ceil(myFeedbacks.total / myFeedbacks.page_size)) }}</span>
                <button class="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40" :disabled="myFeedbacks.page >= Math.ceil(myFeedbacks.total / myFeedbacks.page_size) || feedbacksLoading" @click="loadMyFeedbacks(myFeedbacks.page + 1)">下一页</button>
              </div>
            </div>
          </div>

        </section>
      </div>
    </main>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        enter-to-class="opacity-100 translate-y-0 sm:scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 sm:scale-100"
        leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      >
        <div v-if="feedbackDialog && selectedFeedback" class="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm" @click.self="closeFeedbackDialog">
          <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
              <div class="min-w-0">
                <h3 class="text-base font-semibold text-zinc-900">{{ feedbackDialog === 'preview' ? '反馈预览' : '管理员回复' }}</h3>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>{{ selectedFeedback.category || '意见反馈' }}</span>
                  <span class="rounded-full px-2 py-0.5 ring-1 ring-inset" :class="feedbackStatusClass(selectedFeedback.status)">{{ feedbackStatusText(selectedFeedback.status) }}</span>
                  <span>{{ formatDate(selectedFeedback.create_time) }}</span>
                </div>
              </div>
              <button class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600" @click="closeFeedbackDialog">
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="feedbackDialog === 'preview'" class="prose prose-sm max-w-none prose-zinc text-zinc-700 [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-xl" v-html="sanitizeFeedbackHtml(selectedFeedback.content)"></div>
              <div v-else>
                <div v-if="selectedFeedback.admin_reply" class="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-600/10">
                  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-emerald-700">管理员回复</span>
                    <span v-if="selectedFeedback.reply_time" class="text-[11px] text-emerald-700/70">{{ formatDate(selectedFeedback.reply_time) }}</span>
                  </div>
                  <p class="whitespace-pre-wrap leading-relaxed">{{ selectedFeedback.admin_reply }}</p>
                </div>
                <div v-else class="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-200 text-sm text-zinc-400">暂无回复</div>
              </div>
            </div>

            <div class="flex justify-end border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
              <button class="h-10 rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800" @click="closeFeedbackDialog">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>
