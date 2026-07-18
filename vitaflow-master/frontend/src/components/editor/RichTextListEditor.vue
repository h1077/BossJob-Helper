<script setup lang="ts">
import { ref, watch } from "vue"
import RichTextEditor from "./RichTextEditor.vue"

const props = withDefaults(defineProps<{ modelValue: string[]; placeholder?: string }>(), {
  placeholder: "输入亮点，可使用列表、加粗等格式",
})
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>()
const html = ref(serialize(props.modelValue))
let updatingFromEditor = false

function escapeHtml(value: string) {
  if (/&[a-z]+;|&#[0-9]+;|&#x[0-9a-f]+;/i.test(value)) return value
  const node = document.createElement("div")
  node.textContent = value
  return node.innerHTML
}

function serialize(items: string[] | undefined) {
  const values = Array.isArray(items) ? items.map((item) => String(item).replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;").trim()).filter(Boolean) : []
  if (!values.length) return ""
  return `<ul>${values.map((item) => `<li>${/<[a-z][\s\S]*>/i.test(item) ? item : escapeHtml(item)}</li>`).join("")}</ul>`
}

function parse(value: string) {
  const cleanValue = (value || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;")
  const doc = new DOMParser().parseFromString(cleanValue, "text/html")
  const results: string[] = []

  const processLi = (li: Element) => {
    const style = li.getAttribute("style")
    const align = li.getAttribute("align")
    const inner = li.innerHTML.replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;").trim()
    if (inner && (li.textContent?.trim() || li.querySelector("img"))) {
      if (style || align) {
        const div = document.createElement("div")
        if (style) div.setAttribute("style", style)
        if (align) div.setAttribute("align", align)
        div.innerHTML = inner
        results.push(div.outerHTML)
      } else {
        results.push(inner)
      }
    }
  }

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) results.push(text)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === "br") return
      if (tag === "ul" || tag === "ol") {
        el.querySelectorAll("li").forEach(processLi)
      } else if (tag === "li") {
        processLi(el)
      } else {
        const lis = Array.from(el.querySelectorAll("li"))
        if (lis.length) {
          lis.forEach(processLi)
        } else {
          const outer = el.outerHTML.replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;").trim()
          if (outer && (el.textContent?.trim() || el.querySelector("img"))) {
            results.push(outer)
          }
        }
      }
    }
  })

  return results
}

function update(value: string) {
  updatingFromEditor = true
  const cleanValue = (value || "").replace(/<!--[\s\S]*?-->/g, "").replace(/&lt;!--[\s\S]*?--&gt;/g, "").replace(/&amp;nbsp;/g, "&nbsp;")
  html.value = cleanValue
  emit("update:modelValue", parse(cleanValue))
  queueMicrotask(() => { updatingFromEditor = false })
}

watch(() => props.modelValue, (value) => {
  if (!updatingFromEditor) html.value = serialize(value)
}, { deep: true })
</script>

<template>
  <RichTextEditor :model-value="html" :placeholder="placeholder" @update:model-value="update" />
</template>
