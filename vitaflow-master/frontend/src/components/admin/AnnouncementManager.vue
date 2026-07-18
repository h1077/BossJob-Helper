<script setup lang="ts">
import { onMounted, ref } from "vue"
import { Edit3, Eye, Megaphone, Plus, Trash2, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Select from "@/components/ui/select/Select.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import RichTextEditor from "@/components/admin/RichTextEditor.vue"
import AnnouncementModal from "@/components/announcement/AnnouncementModal.vue"
import {
  createAdminAnnouncementApi, deleteAdminAnnouncementApi, getAdminAnnouncementsApi,
  updateAdminAnnouncementApi, updateAdminAnnouncementStatusApi,
  type AdminAnnouncement, type PageData,
} from "@/api/admin"
import { showGlobalToast } from "@/utils/toast"

const data = ref<PageData<AdminAnnouncement>>({ items: [], total: 0, page: 1, page_size: 20 })
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const showConfirm = ref(false)
const confirmTarget = ref<AdminAnnouncement | null>(null)
const keyword = ref("")
const status = ref("")
const editorOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref<{ title: string; content: string; status: "draft" | "published" }>({ title: "", content: "", status: "draft" })

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]

const formStatusOptions = [
  { label: '保存为草稿', value: 'draft' },
  { label: '立即发布', value: 'published' },
]

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"
}

async function load(page = 1) {
  loading.value = true
  error.value = ""
  try {
    data.value = await getAdminAnnouncementsApi({ page, page_size: 10, keyword: keyword.value, status: status.value || undefined })
  } catch (err: any) {
    error.value = err.message || "公告加载失败"
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { title: "", content: "", status: "draft" }
  editorOpen.value = true
}

function openEdit(item: AdminAnnouncement) {
  editingId.value = item.id
  form.value = { title: item.title, content: item.content, status: item.status }
  editorOpen.value = true
}

async function save() {
  if (!form.value.title.trim()) return (error.value = "请填写公告标题")
  if (!form.value.content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim()) return (error.value = "请填写公告内容")
  saving.value = true
  error.value = ""
  try {
    if (editingId.value) await updateAdminAnnouncementApi(editingId.value, form.value)
    else await createAdminAnnouncementApi(form.value)
    editorOpen.value = false
    await load(editingId.value ? data.value.page : 1)
    showGlobalToast("保存成功")
  } catch (err: any) {
    error.value = err.message || "保存失败"
  } finally {
    saving.value = false
  }
}

async function toggleStatus(item: AdminAnnouncement) {
  const next = item.status === "published" ? "draft" : "published"
  try {
    const updated = await updateAdminAnnouncementStatusApi(item.id, next)
    Object.assign(item, updated)
    showGlobalToast(next === "published" ? "发布成功" : "撤回成功")
  } catch (err: any) {
    error.value = err.message || "状态更新失败"
  }
}

function remove(item: AdminAnnouncement) {
  confirmTarget.value = item
  showConfirm.value = true
}

async function executeRemove() {
  if (!confirmTarget.value) return
  try {
    await deleteAdminAnnouncementApi(confirmTarget.value.id)
    await load(data.value.items.length === 1 && data.value.page > 1 ? data.value.page - 1 : data.value.page)
    showGlobalToast("删除成功")
  } catch (err: any) {
    error.value = err.message || "删除失败"
  } finally {
    showConfirm.value = false
    confirmTarget.value = null
  }
}

const previewOpen = ref(false)
const previewData = ref<any>(null)

function openPreview(item: AdminAnnouncement) {
  previewData.value = {
    id: item.id,
    title: item.title,
    content: item.content,
    published_at: item.published_at || new Date().toISOString(),
  }
  previewOpen.value = true
}

function openFormPreview() {
  previewData.value = {
    id: editingId.value || 0,
    title: form.value.title || "【无标题公告】",
    content: form.value.content || "<p>暂无内容</p>",
    published_at: new Date().toISOString(),
  }
  previewOpen.value = true
}

onMounted(() => load())
</script>

<template>
  <div>
    <div v-if="error" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative w-full sm:w-72">
        <input v-model="keyword" class="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400" placeholder="搜索公告标题" @keyup.enter="load(1)" />
      </div>
      <div class="w-full sm:w-32">
        <Select v-model="status" :options="statusOptions" placeholder="全部状态" class="h-10 w-full rounded-lg" @change="load(1)" />
      </div>
      <Button class="w-full sm:w-auto" @click="openCreate"><Plus class="h-4 w-4" />添加公告</Button>
    </div>

    <div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div v-if="loading" class="flex h-60 items-center justify-center text-sm text-zinc-400">正在加载公告…</div>
      <div v-else-if="!data.items.length" class="flex h-60 flex-col items-center justify-center text-zinc-400"><Megaphone class="mb-3 h-8 w-8" /><p class="text-sm">暂无公告</p></div>
      <div v-else class="divide-y divide-zinc-100">
        <article v-for="item in data.items" :key="item.id" class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0"><div class="flex items-center gap-2"><h3 class="truncate font-medium text-zinc-900">{{ item.title }}</h3><span class="shrink-0 rounded-full px-2 py-1 text-xs" :class="item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'">{{ item.status === 'published' ? '已发布' : '草稿' }}</span><span class="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{{ item.read_count || 0 }} 人已读</span></div><p class="mt-1.5 text-xs text-zinc-400">创建于 {{ formatDate(item.create_time) }}<span v-if="item.published_at"> · 发布于 {{ formatDate(item.published_at) }}</span></p></div>
          <div class="flex shrink-0 items-center gap-2"><Button variant="outline" size="sm" @click="toggleStatus(item)">{{ item.status === 'published' ? '下架' : '发布' }}</Button><Button variant="outline" size="icon" title="预览" @click="openPreview(item)"><Eye class="h-4 w-4" /></Button><Button variant="outline" size="icon" title="编辑" @click="openEdit(item)"><Edit3 class="h-4 w-4" /></Button><Button variant="outline" size="icon" title="删除" @click="remove(item)"><Trash2 class="h-4 w-4 text-red-600" /></Button></div>
        </article>
      </div>
      <footer v-if="data.total > data.page_size" class="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500"><span>共 {{ data.total }} 条</span><div class="flex gap-2"><Button variant="outline" size="sm" :disabled="data.page <= 1" @click="load(data.page - 1)">上一页</Button><Button variant="outline" size="sm" :disabled="data.page * data.page_size >= data.total" @click="load(data.page + 1)">下一页</Button></div></footer>
    </div>

    <Transition name="fade">
      <div v-if="editorOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
        <section class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between border-b border-zinc-100 px-4 sm:px-6 py-3 sm:py-4"><div><h2 class="font-semibold text-zinc-900">{{ editingId ? '编辑公告' : '添加公告' }}</h2><p class="mt-1 text-xs text-zinc-400">支持标题、列表、引用、链接等富文本格式</p></div><button class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100" @click="editorOpen = false"><X class="h-5 w-5" /></button></header>
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"><div><label class="mb-1.5 block text-xs font-medium text-zinc-600">公告标题</label><input v-model="form.title" maxlength="120" class="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400" placeholder="请输入公告标题" /></div><div><label class="mb-1.5 block text-xs font-medium text-zinc-600">公告正文</label><RichTextEditor v-model="form.content" /></div><div><label class="mb-1.5 block text-xs font-medium text-zinc-600">保存状态</label><Select v-model="form.status" :options="formStatusOptions" placeholder="选择保存状态" /></div></div>
          <footer class="flex items-center justify-end gap-2 sm:gap-3 border-t border-zinc-100 bg-zinc-50 px-4 py-3 sm:px-6 sm:py-4"><Button variant="outline" class="hidden sm:inline-flex whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4" @click="openFormPreview"><Eye class="mr-1.5 h-4 w-4" />预览</Button><Button variant="outline" class="whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4" @click="editorOpen = false">取消</Button><Button :disabled="saving" class="whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4" @click="save">{{ saving ? '保存中…' : (form.status === 'published' ? '保存并发布' : '保存草稿') }}</Button></footer>
        </section>
      </div>
    </Transition>

    <ConfirmDialog
      v-model:open="showConfirm"
      title="确认删除公告？"
      :description="`你确定要删除公告 “${confirmTarget?.title}” 吗？删除后将无法恢复。`"
      destructive
      @confirm="executeRemove"
    />

    <AnnouncementModal
      v-if="previewOpen && previewData"
      :announcement="previewData"
      @close="previewOpen = false"
    />
  </div>
</template>
