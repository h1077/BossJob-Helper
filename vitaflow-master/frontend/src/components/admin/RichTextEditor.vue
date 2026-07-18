<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { AlignCenter, AlignLeft, AlignRight, Bold, ImagePlus, Italic, Link, List, ListOrdered, LoaderCircle, Quote, Redo2, Strikethrough, Underline, Undo2, X } from "lucide-vue-next"
import Select from "@/components/ui/select/Select.vue"
import Button from "@/components/ui/button/Button.vue"
import { uploadAiChatImageApi, uploadAnnouncementImageApi } from "@/api/file"

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  allowImages?: boolean
  compact?: boolean
  uploadType?: "announcement" | "user"
}>(), {
  placeholder: "输入正文…",
  allowImages: true,
  compact: false,
  uploadType: "announcement",
})
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const editor = ref<HTMLElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const imageError = ref("")
const selectedImage = ref<HTMLImageElement | null>(null)
let savedRange: Range | null = null

const allowedTags = new Set(["P", "BR", "DIV", "SPAN", "FONT", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "UL", "OL", "LI", "A", "HR"])
const allowedAttributes: Record<string, Set<string>> = {
  A: new Set(["href", "title", "target", "rel"]),
  FONT: new Set(["color", "size"]),
  IMG: new Set(["src", "alt", "title", "width", "height", "data-size"]),
}

function safeUrl(value: string) {
  return /^(https?:|mailto:|\/)/i.test(value.trim())
}

function escapeText(value: string) {
  const node = document.createElement("div")
  node.textContent = value
  return node.innerHTML
}

function sanitizeEditorHtml(value: string) {
  const cleanValue = (value || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;")
  const doc = new DOMParser().parseFromString(cleanValue, "text/html")
  doc.body.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove())
  Array.from(doc.body.querySelectorAll("*")).forEach((node) => {
    const tag = node.tagName
    if (!allowedTags.has(tag) && !(props.allowImages && tag === "IMG")) {
      node.replaceWith(...Array.from(node.childNodes))
      return
    }
    const attributes = allowedAttributes[tag] || new Set<string>()
    Array.from(node.attributes).forEach((attribute) => {
      const attrName = attribute.name.toLowerCase()
      if (!attributes.has(attrName) && attrName !== "style" && attrName !== "align") node.removeAttribute(attribute.name)
    })
    if (tag === "A") {
      const href = node.getAttribute("href") || ""
      if (href && !safeUrl(href)) node.removeAttribute("href")
      node.setAttribute("rel", "noopener noreferrer")
    }
    if (tag === "IMG") {
      const src = node.getAttribute("src") || ""
      if (!safeUrl(src)) node.remove()
    }
  })
  return doc.body.innerHTML.replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;")
}

const blockTypeOptions = [
  { label: '正文', value: 'p' },
  { label: '二级标题', value: 'h2' },
  { label: '三级标题', value: 'h3' },
]
const fontSizeOptions = [
  { label: '正常', value: '3' },
  { label: '极小', value: '1' },
  { label: '小号', value: '2' },
  { label: '中号', value: '4' },
  { label: '大号', value: '5' },
  { label: '特大', value: '6' },
  { label: '超大', value: '7' },
]
const currentBlockType = ref('p')
const currentFontSize = ref('3')

function handleBlockTypeChange(val: string) {
  setTimeout(() => command('formatBlock', val), 10)
}

function handleFontSizeChange(val: string) {
  setTimeout(() => command('fontSize', val), 10)
}

function syncContent() {
  const safeValue = sanitizeEditorHtml(props.modelValue || "")
  if (editor.value && editor.value.innerHTML !== safeValue) editor.value.innerHTML = safeValue
}

function command(name: string, value?: string) {
  editor.value?.focus()
  restoreSelection()
  
  if (selectedImage.value && (name === 'justifyLeft' || name === 'justifyCenter' || name === 'justifyRight')) {
    const align = name === 'justifyLeft' ? 'left' : name === 'justifyCenter' ? 'center' : 'right'
    const margin = name === 'justifyLeft' ? '0 auto 0 0' : name === 'justifyCenter' ? '0 auto' : '0 0 0 auto'
    
    selectedImage.value.style.display = 'block'
    selectedImage.value.style.margin = margin
    selectedImage.value.setAttribute('align', align)
  } else {
    const targetImages: HTMLImageElement[] = []
    if (editor.value && (name === 'justifyLeft' || name === 'justifyCenter' || name === 'justifyRight')) {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      const images = editor.value.querySelectorAll('img')
      
      images.forEach((img) => {
        if (selection && range) {
          try {
            if (selection.containsNode(img, true) || range.intersectsNode(img)) {
              targetImages.push(img)
            }
          } catch (e) {
            // fallback
          }
        }
      })
    }

    if (name === 'strikeThrough') {
      if (!document.execCommand('strikeThrough', false, value)) {
        document.execCommand('strikethrough', false, value)
      }
    } else {
      document.execCommand(name, false, value)
    }
    
    if (targetImages.length > 0 && (name === 'justifyLeft' || name === 'justifyCenter' || name === 'justifyRight')) {
      const align = name === 'justifyLeft' ? 'left' : name === 'justifyCenter' ? 'center' : 'right'
      const margin = name === 'justifyLeft' ? '0 auto 0 0' : name === 'justifyCenter' ? '0 auto' : '0 0 0 auto'
      
      targetImages.forEach((img) => {
        img.style.display = 'block'
        img.style.margin = margin
        img.setAttribute('align', align)
      })
    }
  }
  
  emit("update:modelValue", (editor.value?.innerHTML || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;"))
  saveSelection()
}

const linkDialogOpen = ref(false)
const linkUrl = ref("")
const linkInputRef = ref<HTMLInputElement | null>(null)

function addLink() {
  saveSelection()
  linkUrl.value = ""
  linkDialogOpen.value = true
  nextTick(() => {
    linkInputRef.value?.focus()
  })
}

function confirmAddLink() {
  if (!linkUrl.value.trim()) return
  linkDialogOpen.value = false
  let url = linkUrl.value.trim()
  if (!/^https?:\/\/|^mailto:|^[./]/i.test(url)) {
    url = "https://" + url
  }
  editor.value?.focus()
  restoreSelection()
  command("createLink", url)
}

function saveSelection() {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor.value) return
  const range = selection.getRangeAt(0)
  if (editor.value.contains(range.commonAncestorContainer)) savedRange = range.cloneRange()
}

function restoreSelection() {
  if (!savedRange) return
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(savedRange)
}

function chooseImage() {
  saveSelection()
  imageInput.value?.click()
}

async function insertImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return
  imageError.value = ""
  uploadingImage.value = true
  try {
    const result = props.uploadType === "user" ? await uploadAiChatImageApi(file) : await uploadAnnouncementImageApi(file)
    editor.value?.focus()
    restoreSelection()
    const image = document.createElement("img")
    image.src = result.url
    image.alt = file.name
    image.dataset.size = "100"
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.value?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(image)
      range.setStartAfter(image)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      editor.value?.appendChild(image)
    }
    selectImage(image)
    emit("update:modelValue", (editor.value?.innerHTML || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;"))
  } catch (error: any) {
    imageError.value = error.message || "图片上传失败"
  } finally {
    uploadingImage.value = false
  }
}

function selectImage(image: HTMLImageElement | null) {
  selectedImage.value?.classList.remove("is-selected")
  selectedImage.value = image
  selectedImage.value?.classList.add("is-selected")
}

function handleEditorClick(event: MouseEvent) {
  const target = event.target
  selectImage(target instanceof HTMLImageElement ? target : null)
}

function handleEditorInput(event: Event) {
  if (selectedImage.value && !editor.value?.contains(selectedImage.value)) selectImage(null)
  const content = (event.target as HTMLElement).innerHTML.replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;")
  emit("update:modelValue", content)
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const richValue = event.clipboardData?.getData("text/html") || ""
  const plainValue = event.clipboardData?.getData("text/plain") || ""
  const value = richValue || plainValue.split(/\r?\n/).map((line) => `<p>${escapeText(line)}</p>`).join("")
  command("insertHTML", sanitizeEditorHtml(value))
}

function setImageSize(size: number) {
  if (!selectedImage.value) return
  selectedImage.value.dataset.size = String(size)
  emit("update:modelValue", (editor.value?.innerHTML || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;"))
}

watch(() => props.modelValue, () => nextTick(syncContent))
onMounted(() => {
  syncContent()
  document.addEventListener("selectionchange", saveSelection)
})
onUnmounted(() => {
  document.removeEventListener("selectionchange", saveSelection)
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-zinc-200 bg-white focus-within:border-zinc-400">
    <div class="flex flex-wrap items-center gap-x-0.5 sm:gap-x-1.5 md:gap-x-3 gap-y-1 sm:gap-y-1.5 border-b border-zinc-100 bg-zinc-50/80 px-1 sm:px-2 py-1.5 sm:py-2 md:px-3 md:py-2.5">
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-0.5 md:gap-1 shrink-0">
        <button type="button" class="editor-button !rounded-lg" title="撤销" @mousedown.prevent @click="command('undo')"><Undo2 class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="重做" @mousedown.prevent @click="command('redo')"><Redo2 class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
      </div>
      <div class="h-3.5 md:h-4 w-[1px] bg-zinc-200 shrink-0 hidden sm:block"></div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-0.5 md:gap-1 shrink-0" @mousedown.prevent>
        <div class="w-16 md:w-24 shrink-0">
          <Select v-model="currentBlockType" :options="blockTypeOptions" ghost class="!h-7 md:!h-8 !text-xs !bg-transparent !border-none !shadow-none !px-1 md:!px-2 !rounded-lg !font-medium !text-zinc-600 hover:!bg-zinc-300 hover:!text-zinc-950 data-[state=open]:!bg-zinc-300 data-[state=open]:!text-zinc-950 data-[state=open]:!ring-0 !transition-all" @change="handleBlockTypeChange" />
        </div>
        <div class="w-[3.25rem] md:w-20 shrink-0">
          <Select v-model="currentFontSize" :options="fontSizeOptions" ghost class="!h-7 md:!h-8 !text-xs !bg-transparent !border-none !shadow-none !px-1 md:!px-2 !rounded-lg !font-medium !text-zinc-600 hover:!bg-zinc-300 hover:!text-zinc-950 data-[state=open]:!bg-zinc-300 data-[state=open]:!text-zinc-950 data-[state=open]:!ring-0 !transition-all" @change="handleFontSizeChange" />
        </div>
        <label class="editor-button !rounded-lg relative cursor-pointer" title="文字颜色" @mousedown.prevent><span class="text-xs md:text-sm font-bold">A</span><span class="absolute bottom-1 h-0.5 w-3 md:w-4 bg-gradient-to-r from-red-500 via-green-500 to-blue-500"></span><input type="color" class="absolute inset-0 cursor-pointer opacity-0" @input="command('foreColor', ($event.target as HTMLInputElement).value)" /></label>
      </div>
      <div class="h-3.5 md:h-4 w-[1px] bg-zinc-200 shrink-0 hidden sm:block"></div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-0.5 md:gap-1 shrink-0">
        <button type="button" class="editor-button !rounded-lg" title="粗体" @mousedown.prevent @click="command('bold')"><Bold class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="斜体" @mousedown.prevent @click="command('italic')"><Italic class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="下划线" @mousedown.prevent @click="command('underline')"><Underline class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="删除线" @mousedown.prevent @click="command('strikeThrough')"><Strikethrough class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
      </div>
      <div class="h-3.5 md:h-4 w-[1px] bg-zinc-200 shrink-0 hidden sm:block"></div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-0.5 md:gap-1 shrink-0">
        <button type="button" class="editor-button !rounded-lg" title="左对齐" @mousedown.prevent @click="command('justifyLeft')"><AlignLeft class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="居中对齐" @mousedown.prevent @click="command('justifyCenter')"><AlignCenter class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="右对齐" @mousedown.prevent @click="command('justifyRight')"><AlignRight class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
      </div>
      <div class="h-3.5 md:h-4 w-[1px] bg-zinc-200 shrink-0 hidden sm:block"></div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-0.5 md:gap-1 shrink-0">
        <button type="button" class="editor-button !rounded-lg" title="无序列表" @mousedown.prevent @click="command('insertUnorderedList')"><List class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="有序列表" @mousedown.prevent @click="command('insertOrderedList')"><ListOrdered class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="引用" @mousedown.prevent @click="command('formatBlock', 'blockquote')"><Quote class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button type="button" class="editor-button !rounded-lg" title="链接" @mousedown.prevent @click="addLink"><Link class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <button v-if="allowImages" type="button" class="editor-button !rounded-lg" :disabled="uploadingImage" title="插入图片" @mousedown.prevent @click="chooseImage"><LoaderCircle v-if="uploadingImage" class="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" /><ImagePlus v-else class="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
        <input v-if="allowImages" ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="insertImage" />
      </div>
    </div>
    <div v-if="selectedImage" class="flex items-center gap-2 border-b border-zinc-100 bg-blue-50/70 px-3 py-2 text-xs text-zinc-600">
      <span class="mr-1 font-medium">图片宽度</span>
      <button v-for="size in [25, 50, 75, 100]" :key="size" type="button" class="rounded-md border px-2.5 py-1 transition" :class="Number(selectedImage.dataset.size || 100) === size ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:bg-zinc-50'" @click="setImageSize(size)">{{ size }}%</button>
    </div>
    <div
      ref="editor"
      contenteditable
      class="rich-text-editor px-4 py-3 text-sm text-zinc-700 outline-none"
      :class="compact ? 'min-h-32' : 'min-h-56'"
      :data-placeholder="placeholder"
      @click="handleEditorClick"
      @input="handleEditorInput"
      @paste="handlePaste"
    ></div>
    <p v-if="imageError" class="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{{ imageError }}</p>

    <Transition name="fade">
      <div v-if="linkDialogOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" @click.self="linkDialogOpen = false">
        <section class="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h3 class="font-semibold text-zinc-900">添加链接</h3>
            <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100" @click="linkDialogOpen = false"><X class="h-5 w-5" /></button>
          </header>
          <div class="p-6">
            <label class="mb-1.5 block text-xs font-medium text-zinc-600">链接地址</label>
            <input v-model="linkUrl" ref="linkInputRef" type="url" class="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400" placeholder="https://example.com" @keyup.enter="confirmAddLink" />
          </div>
          <footer class="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50 px-6 py-4">
            <Button variant="outline" @click="linkDialogOpen = false">取消</Button>
            <Button @click="confirmAddLink">确认</Button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.editor-button { display: inline-flex; height: 1.75rem; width: 1.75rem; align-items: center; justify-content: center; border-radius: 0.4rem !important; overflow: hidden !important; appearance: none !important; color: #52525b; background-color: transparent; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
@media (min-width: 768px) {
  .editor-button { height: 2rem; width: 2rem; border-radius: 0.5rem !important; }
}
.editor-button:hover, .editor-button:focus-visible { background-color: #d4d4d8 !important; color: #09090b !important; }
.editor-button:active { background-color: #a1a1aa !important; }
.editor-button:disabled { cursor: not-allowed; opacity: .5; }
.rich-text-editor:empty::before { content: attr(data-placeholder); color: #a1a1aa; pointer-events: none; }
.rich-text-editor :deep(h1), .rich-text-editor :deep(h2), .rich-text-editor :deep(h3), .rich-text-editor :deep(h4) { margin: 1em 0 .45em; color: #18181b; font-weight: 700; line-height: 1.35; }
.rich-text-editor :deep(h1) { font-size: 1.5rem; }
.rich-text-editor :deep(h2) { font-size: 1.25rem; }
.rich-text-editor :deep(h3) { font-size: 1.1rem; }
.rich-text-editor :deep(p) { margin: .35em 0; }
.rich-text-editor :deep(ul), .rich-text-editor :deep(ol) { margin: .6em 0; padding-left: 1.5rem; }
.rich-text-editor :deep(ul) { list-style: disc; }
.rich-text-editor :deep(ol) { list-style: decimal; }
.rich-text-editor :deep(blockquote) { margin: .8em 0; border-left: 3px solid #d4d4d8; background: #fafafa; padding: .6rem .9rem; color: #52525b; }
.rich-text-editor :deep(s), .rich-text-editor :deep(strike), .rich-text-editor :deep(del), .rich-text-editor :deep(span[style*="line-through"]) { text-decoration: line-through !important; text-decoration-line: line-through !important; }
.rich-text-editor :deep(u) { text-decoration: underline; }
.rich-text-editor :deep(b), .rich-text-editor :deep(strong) { font-weight: bold; }
.rich-text-editor :deep(i), .rich-text-editor :deep(em) { font-style: italic; }
.rich-text-editor :deep(a) { color: #2563eb; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(37, 99, 235, 0.3); text-decoration-thickness: 1.5px; transition: all 0.2s ease; }
.rich-text-editor :deep(a:hover) { color: #1d4ed8; text-decoration-color: #2563eb; }
.rich-text-editor :deep(img) { display: inline-block; max-width: 100%; height: auto; margin: .75rem 0; border-radius: .65rem; cursor: pointer; }
.rich-text-editor :deep(img[data-size="25"]) { width: 25%; }
.rich-text-editor :deep(img[data-size="50"]) { width: 50%; }
.rich-text-editor :deep(img[data-size="75"]) { width: 75%; }
.rich-text-editor :deep(img[data-size="100"]) { width: 100%; }
.rich-text-editor :deep(img.is-selected) { outline: 2px solid #2563eb; outline-offset: 3px; }
</style>
