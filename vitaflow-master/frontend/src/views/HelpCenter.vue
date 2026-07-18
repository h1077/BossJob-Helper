<script setup lang="ts">
import { computed, ref } from "vue"
import { RouterLink } from "vue-router"
import {
  Bot,
  CheckCircle2,
  CircleHelp,
  Download,
  FileText,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  LayoutTemplate,
  Palette,
  Command,
  Sparkles,
} from "lucide-vue-next"
import AppLayout from "@/components/layout/AppLayout.vue"
import FlowPointIcon from "@/components/ui/FlowPointIcon.vue"
import Button from "@/components/ui/button/Button.vue"
import { useUserStore } from "@/stores/user"

type HelpTopic = {
  id: string
  title: string
  description: string
  icon: any
  accent: string
  steps: string[]
}

const user = useUserStore()
const activeTopicId = ref("start")

const quickStartActions = computed(() => [
  {
    title: "选择模板",
    description: "从模板开始创建或导入简历",
    to: "/templates",
    icon: LayoutTemplate,
    primary: true,
  },
  {
    title: "我的简历",
    description: "继续编辑、复制、分享或导出",
    to: user.token ? "/resumes" : "/login",
    icon: FileText,
    primary: false,
  },
  {
    title: "提交反馈",
    description: "遇到问题时查看处理进度",
    to: user.token ? "/profile?tab=feedback" : "/login",
    icon: MessageSquare,
    primary: false,
  },
])

const helpHighlights = ["新手上手", "AI 优化", "导出分享"]

const topics: HelpTopic[] = [
  {
    id: "start",
    title: "快速开始",
    description: "适合第一次使用 VitaFlow 的用户，从模板到第一份简历只需要几步。",
    icon: Sparkles,
    accent: "bg-zinc-950 text-white",
    steps: [
      "进入模板中心，选择与你行业和岗位气质接近的模板。",
      "点击开始使用，可以创建空白简历，也可以上传 PDF、Word、文本或图片导入。",
      "进入编辑器后，先补齐基本信息，再完善教育、工作、项目和技能模块。",
      "右侧预览会同步展示最终排版，确认无误后即可导出或分享。",
    ],
  },
  {
    id: "editor",
    title: "编辑简历",
    description: "编辑器采用模块化结构，适合按经历逐段打磨，也支持灵活调整顺序。",
    icon: FileText,
    accent: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
    steps: [
      "左侧模块栏用于切换内容区，可按基本信息、工作经历、项目经历等维度填写。",
      "常用模块支持新增多条记录，建议把最近、最相关的经历放在前面。",
      "头像、个人字段、富文本描述和自定义模块都可以按目标岗位调整。",
      "编辑过程中系统会保存内容，离开页面前仍建议确认右侧预览已更新。",
    ],
  },
  {
    id: "ai",
    title: "AI 优化",
    description: "AI 能帮助生成初稿、诊断问题、润色模块，并根据 JD 做匹配优化。",
    icon: Bot,
    accent: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
    steps: [
      "没有完整简历时，可以先用 AI 生成基础内容，再人工补充细节和数据。",
      "简历评分会给出整体诊断、亮点、短板和可执行的修改建议。",
      "模块润色适合优化经历表达，建议保留真实数据和关键业务结果。",
      "JD 优化会对照岗位描述强化匹配度，生成结果需要逐条确认后再应用。",
    ],
  },
  {
    id: "template",
    title: "模板与样式",
    description: "模板决定整体版式，样式配置用于微调视觉密度和个人呈现。",
    icon: Palette,
    accent: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    steps: [
      "求职正式岗位可优先选择简洁、留白稳定的模板。",
      "设计、运营、产品等岗位可以选择更强调层次和视觉识别的模板。",
      "字体、颜色、间距和头像显示会影响阅读节奏，修改后请观察整页预览。",
      "内容较多时，优先压缩描述和模块数量，再调整字号或间距。",
    ],
  },
  {
    id: "export",
    title: "导出与分享",
    description: "完成排版后，可以导出 PDF/Word，也可以生成公开分享链接。",
    icon: Download,
    accent: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    steps: [
      "PDF 更适合投递和打印，Word 更适合继续交给他人编辑。",
      "导出前检查头像、联系方式、分页和重点经历是否展示完整。",
      "公开分享链接适合在线预览，发送前请确认没有不希望公开的信息。",
      "如遇导出样式异常，先刷新预览并重试，仍有问题可提交反馈。",
    ],
  },
  {
    id: "points",
    title: "Flow Points",
    description: "Flow Points 用于 AI 生成、导入解析、诊断和优化等智能能力。",
    icon: FlowPointIcon,
    accent: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100",
    steps: [
      "在 Flow Points 页面可以查看余额、调用记录、消费明细和生成历史。",
      "不同 AI 功能会按后台规则消耗点数，部分功能可能包含按 Tokens 计费。",
      "兑换码可以在 Flow Points 页面使用，成功后点数会立即入账。",
      "如果某次 AI 调用失败，可在记录里查看状态，并结合反馈入口联系管理员。",
    ],
  },
  {
    id: "account",
    title: "账号与安全",
    description: "个人中心提供账号信息、密码修改和意见反馈等基础能力。",
    icon: LockKeyhole,
    accent: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    steps: [
      "注册和登录依赖邮箱验证码，请确认邮箱地址填写正确。",
      "个人中心可以修改用户名和密码，也可以提交问题反馈。",
      "使用公共电脑后建议主动退出登录，避免简历和联系方式暴露。",
      "定期检查账号信息和联系方式，确保投递与分享时展示的是最新资料。",
    ],
  },
]

const activeTopic = computed(() => topics.find((item) => item.id === activeTopicId.value) || topics[0])

const faqs = [
  {
    question: "收不到邮箱验证码怎么办？",
    answer: "先检查邮箱地址、垃圾邮件和网络状态；如果多次发送仍未收到，可以稍后重试或通过反馈入口联系管理员。",
  },
  {
    question: "导入简历后内容不准确怎么办？",
    answer: "导入解析会尽量还原结构，但复杂排版可能需要手动校对。建议先检查基本信息、时间线和项目描述，再使用 AI 润色补强表达。",
  },
  {
    question: "PDF 导出和预览有差异怎么办？",
    answer: "先刷新页面并重新生成预览，确认字体、头像和分页稳定后再导出。若问题持续，请提交反馈并说明模板名称和简历内容位置。",
  },
  {
    question: "AI 优化结果可以直接使用吗？",
    answer: "建议不要完全照搬。AI 更适合提供初稿和表达建议，最终内容仍需要你确认事实、数据、岗位关键词和个人风格。",
  },
]
</script>

<template>
  <AppLayout>
    <div class="min-h-screen bg-white">
      <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <section class="border-b border-zinc-200 pb-8 lg:pb-12">
          <div class="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div class="flex flex-col lg:pr-4">
              <div>
                <p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">Help Center</p>
                <h1 class="text-2xl sm:text-3xl font-semibold text-zinc-950 tracking-tight">帮助中心</h1>
                <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500 leading-relaxed">
                  查阅使用指南与常见问题解答，快速获取所需帮助。
                </p>
              </div>

              <div class="mt-6 sm:mt-8">
                <h3 class="mb-3 flex items-center gap-2.5 text-base sm:text-lg font-semibold text-zinc-900">
                  <div class="h-4 w-1.5 rounded-full bg-zinc-800"></div>
                  什么是 VitaFlow？
                </h3>
                <div class="space-y-4 text-sm sm:text-[15px] leading-relaxed text-zinc-500">
                  <p class="text-[15px] font-medium leading-relaxed text-zinc-800 sm:text-base">
                    <span class="font-bold text-zinc-900">Elliot:</span> “VitaFlow 简历流是面向现代求职者的次世代智能简历生成与优化平台。我们将前沿的生成式 AI 技术与极简高级的美学排版深度结合，帮助您在激烈的职场竞争中脱颖而出。”
                  </p>
                  <p>
                    <strong class="font-medium text-zinc-700">创作理念：</strong>我们坚信，一份优秀的简历不应只是枯燥的信息堆砌，而是展现个人专业度与审美格调的绝佳媒介。VitaFlow 致力于消除所有繁琐的格式排版，让求职者能将 100% 的精力聚焦于自身价值的表达——因为，“你的经历，值得更好的表达。”
                  </p>
                </div>
              </div>
            </div>

          <aside class="hidden lg:block relative w-full rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-sm">
            <div class="mb-6 flex items-center justify-between px-1">
              <div class="flex items-center gap-2.5">
                <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                  <Command class="h-4 w-4" />
                </div>
                <h3 class="text-base font-semibold tracking-tight text-zinc-900">快捷入口</h3>
              </div>
              <span class="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Shortcuts</span>
            </div>
            
            <div class="flex flex-col gap-2">
              <RouterLink
                v-for="action in quickStartActions"
                :key="action.title"
                :to="action.to"
                class="group flex items-center gap-4 rounded-2xl p-3 sm:p-4 transition-colors hover:bg-zinc-50"
              >
                <!-- 图标 -->
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
                  :class="action.primary ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500 group-hover:border-zinc-300 group-hover:text-zinc-900'"
                >
                  <component :is="action.icon" class="h-4 w-4" />
                </span>
                
                <!-- 文本信息 -->
                <span class="min-w-0 flex-1">
                  <span class="block text-[14px] font-medium text-zinc-900">{{ action.title }}</span>
                  <span class="block truncate text-[13px] text-zinc-500 mt-0.5">{{ action.description }}</span>
                </span>
                
                <!-- 极简箭头 -->
                <span class="text-zinc-300 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </span>
              </RouterLink>
            </div>
          </aside>
        </div>
      </section>

      <section class="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav class="flex overflow-x-auto gap-2 lg:flex-col lg:rounded-[2rem] lg:border lg:border-zinc-200 lg:bg-white lg:p-3 lg:shadow-sm lg:sticky lg:top-24 lg:self-start scrollbar-hide pb-2 lg:pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            v-for="topic in topics"
            :key="topic.id"
            class="flex shrink-0 lg:w-full items-center gap-2 lg:gap-3 rounded-full lg:rounded-2xl px-4 py-2.5 lg:py-3 text-left text-sm font-medium transition"
            :class="activeTopicId === topic.id ? 'bg-zinc-950 text-white shadow-md shadow-zinc-900/10' : 'bg-zinc-100 lg:bg-transparent text-zinc-500 hover:bg-zinc-200 lg:hover:bg-zinc-100 hover:text-zinc-950'"
            @click="activeTopicId = topic.id"
          >
            <component :is="topic.icon" class="h-4 w-4 shrink-0" />
            <span>{{ topic.title }}</span>
          </button>
        </nav>

        <article class="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <header class="border-b border-zinc-100 p-5 sm:p-8">
            <div class="flex flex-row items-start justify-between gap-4 sm:gap-5">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Guide</p>
                <h2 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{{ activeTopic.title }}</h2>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{{ activeTopic.description }}</p>
              </div>
              <span class="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl mt-1 sm:mt-0" :class="activeTopic.accent">
                <component :is="activeTopic.icon" class="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
            </div>
          </header>

          <div class="p-6 sm:p-8">
            <ol class="space-y-4">
              <li
                v-for="(step, index) in activeTopic.steps"
                :key="step"
                class="flex gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4"
              >
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200">
                  {{ index + 1 }}
                </span>
                <p class="text-sm leading-6 text-zinc-600">{{ step }}</p>
              </li>
            </ol>
          </div>
        </article>
      </section>

      <section class="mt-10">
        <div class="mb-5 flex items-end justify-between gap-4">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">FAQ</p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-950">常见问题</h2>
          </div>
          <CircleHelp class="hidden h-6 w-6 text-zinc-300 sm:block" />
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <section
            v-for="item in faqs"
            :key="item.question"
            class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div class="flex items-start gap-3">
              <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <h3 class="text-sm font-semibold text-zinc-950">{{ item.question }}</h3>
                <p class="mt-2 text-sm leading-6 text-zinc-500">{{ item.answer }}</p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="mt-10 rounded-[2rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm sm:p-8">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="max-w-2xl">
            <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              <LifeBuoy class="h-4 w-4" />
              Support
            </div>
            <h2 class="mt-3 text-xl font-semibold tracking-tight">没有找到答案？</h2>
            <p class="mt-2 text-sm leading-6 text-zinc-300">
              把问题、使用场景和出现异常的位置写清楚，管理员处理后你可以在个人中心查看反馈状态和回复。
            </p>
          </div>
          <RouterLink :to="user.token ? '/profile?tab=feedback' : '/login'" class="shrink-0">
            <Button class="h-11 rounded-xl bg-white px-5 text-zinc-950 hover:bg-zinc-100">
              <MessageSquare class="mr-2 h-4 w-4" />
              提交反馈
            </Button>
          </RouterLink>
        </div>
      </section>
    </main>
    </div>
  </AppLayout>
</template>
