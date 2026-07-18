import { defineStore } from "pinia"

export interface EditorHistorySnapshot {
  title: string
  language: string
  resume_data: Record<string, any>
  template_id: string
  template_config: Record<string, any>
}

interface EditorHistoryEntry {
  label: string
  snapshot: string
}

const HISTORY_LIMIT = 50

function serializeSnapshot(snapshot: EditorHistorySnapshot) {
  return JSON.stringify(snapshot)
}

function deserializeSnapshot(entry: EditorHistoryEntry | undefined): EditorHistorySnapshot | null {
  if (!entry) return null
  return JSON.parse(entry.snapshot) as EditorHistorySnapshot
}

export const useEditorStore = defineStore("editor", {
  state: () => ({
    currentSection: "basics",
    saving: false,
    saved: true,
    saveError: false,
    previewScale: 0.72,
    history: [] as EditorHistoryEntry[],
    historyIndex: -1,
    applyingHistory: false,
  }),
  getters: {
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex >= 0 && state.historyIndex < state.history.length - 1,
    undoLabel: (state) => state.historyIndex > 0 ? state.history[state.historyIndex].label : "",
    redoLabel: (state) => state.historyIndex >= 0 && state.historyIndex < state.history.length - 1
      ? state.history[state.historyIndex + 1].label
      : "",
  },
  actions: {
    setCurrentSection(section: string) {
      this.currentSection = section
    },
    setPreviewScale(scale: number) {
      this.previewScale = scale
    },
    setSaving(value: boolean) {
      this.saving = value
    },
    setSaved(value: boolean) {
      this.saved = value
      this.saveError = false
    },
    resetHistory(snapshot: EditorHistorySnapshot) {
      this.history = [{ label: "初始状态", snapshot: serializeSnapshot(snapshot) }]
      this.historyIndex = 0
      this.applyingHistory = false
    },
    commitHistory(snapshot: EditorHistorySnapshot, label = "编辑内容") {
      if (this.applyingHistory) return false
      const serialized = serializeSnapshot(snapshot)
      const current = this.history[this.historyIndex]
      if (current?.snapshot === serialized) return false

      this.history = this.history.slice(0, this.historyIndex + 1)
      this.history.push({ label, snapshot: serialized })
      if (this.history.length > HISTORY_LIMIT) this.history.shift()
      this.historyIndex = this.history.length - 1
      return true
    },
    takeUndoSnapshot() {
      if (!this.canUndo) return null
      this.historyIndex -= 1
      return deserializeSnapshot(this.history[this.historyIndex])
    },
    takeRedoSnapshot() {
      if (!this.canRedo) return null
      this.historyIndex += 1
      return deserializeSnapshot(this.history[this.historyIndex])
    },
    clearHistory() {
      this.history = []
      this.historyIndex = -1
      this.applyingHistory = false
    },
  },
})
