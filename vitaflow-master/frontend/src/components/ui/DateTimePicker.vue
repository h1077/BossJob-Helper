<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"

const props = defineProps<{
  modelValue: string // e.g. "2026-07-04T09:40"
  placeholder?: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()

const open = ref(false)
const currentDate = ref(new Date())
const selectedDate = ref(new Date())
const hour = ref(9)
const minute = ref(0)

// Initialize from modelValue
watch(() => props.modelValue, (val) => {
  if (val) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      selectedDate.value = d
      currentDate.value = new Date(d)
      hour.value = d.getHours()
      minute.value = d.getMinutes()
      return
    }
  }
  // Default to 7 days later 09:00 if empty
  const tmrw = new Date()
  tmrw.setDate(tmrw.getDate() + 7)
  tmrw.setHours(9, 0, 0, 0)
  selectedDate.value = tmrw
  currentDate.value = new Date(tmrw)
  hour.value = 9
  minute.value = 0
}, { immediate: true })

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth()) // 0-11

const monthDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  
  const days = []
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    })
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    })
  }
  // Next month days to complete grid (42 cells)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    })
  }
  return days
})

function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

function selectDay(d: Date) {
  selectedDate.value = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour.value, minute.value)
}

function isSelected(d: Date) {
  return d.getFullYear() === selectedDate.value.getFullYear() &&
         d.getMonth() === selectedDate.value.getMonth() &&
         d.getDate() === selectedDate.value.getDate()
}

function isToday(d: Date) {
  const today = new Date()
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate()
}

function setTime(h: number, m: number) {
  hour.value = h
  minute.value = m
  selectedDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), h, m)
}

function selectToday() {
  const now = new Date()
  selectedDate.value = now
  currentDate.value = new Date(now)
  hour.value = now.getHours()
  minute.value = now.getMinutes()
}

function confirm() {
  const y = selectedDate.value.getFullYear()
  const m = String(selectedDate.value.getMonth() + 1).padStart(2, '0')
  const d = String(selectedDate.value.getDate()).padStart(2, '0')
  const h = String(hour.value).padStart(2, '0')
  const min = String(minute.value).padStart(2, '0')
  emit("update:modelValue", `${y}-${m}-${d}T${h}:${min}`)
  open.value = false
}

const displayString = computed(() => {
  if (!props.modelValue) return props.placeholder || "请选择具体时间"
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return props.placeholder || "请选择具体时间"
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日 ${h}:${min}`
})

const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

const quickTimes = [
  { label: "09:00", h: 9, m: 0 },
  { label: "12:00", h: 12, m: 0 },
  { label: "18:00", h: 18, m: 0 },
  { label: "23:59", h: 23, m: 59 },
]
</script>

<template>
  <div class="relative w-full">
    <!-- Trigger Button -->
    <button
      type="button"
      class="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50/50 active:scale-[0.99] outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
      @click="open = true"
    >
      <span class="truncate font-medium" :class="modelValue ? 'text-zinc-900' : 'text-zinc-400'">{{ displayString }}</span>
      <CalendarIcon class="h-4 w-4 text-zinc-400 shrink-0 ml-2" />
    </button>

    <!-- Modal Popover -->
    <Teleport to="body">
      <Transition name="fade-scale">
        <div v-if="open" class="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm" @click.self="open = false">
          <div class="w-full max-w-sm overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200">
            <!-- Header Month Nav -->
            <div class="flex items-center justify-between mb-4">
              <span class="text-base font-bold tracking-tight text-zinc-900">{{ currentYear }}年 {{ currentMonth + 1 }}月</span>
              <div class="flex items-center gap-1">
                <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors" @click="prevMonth">
                  <ChevronLeft class="h-4 w-4" />
                </button>
                <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors" @click="nextMonth">
                  <ChevronRight class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Week Labels -->
            <div class="grid grid-cols-7 gap-1 mb-2 text-center">
              <span v-for="label in weekLabels" :key="label" class="text-[11px] font-semibold text-zinc-400 py-1">{{ label }}</span>
            </div>

            <!-- Calendar Grid -->
            <div class="grid grid-cols-7 gap-1 mb-5 text-center">
              <button
                v-for="(day, idx) in monthDays"
                :key="idx"
                type="button"
                class="relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-all mx-auto active:scale-95"
                :class="[
                  isSelected(day.date)
                    ? 'bg-zinc-900 text-white font-bold shadow-md'
                    : day.isCurrentMonth
                      ? 'text-zinc-800 hover:bg-zinc-100'
                      : 'text-zinc-300 hover:bg-zinc-50',
                  isToday(day.date) && !isSelected(day.date) ? 'text-blue-600 font-extrabold bg-blue-50/50' : ''
                ]"
                @click="selectDay(day.date)"
              >
                {{ day.date.getDate() }}
              </button>
            </div>

            <!-- Time section -->
            <div class="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3.5 mb-5">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  <Clock class="h-3.5 w-3.5 text-zinc-500" />
                  <span>具体时间</span>
                </div>
                <span class="text-xs font-bold text-zinc-900 font-mono">{{ String(hour).padStart(2, '0') }}:{{ String(minute).padStart(2, '0') }}</span>
              </div>

              <!-- Quick Times -->
              <div class="grid grid-cols-4 gap-2 mb-3">
                <button
                  v-for="qt in quickTimes"
                  :key="qt.label"
                  type="button"
                  class="rounded-xl border py-1.5 text-xs font-medium transition-all"
                  :class="hour === qt.h && minute === qt.m ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'"
                  @click="setTime(qt.h, qt.m)"
                >
                  {{ qt.label }}
                </button>
              </div>

              <!-- Steppers / Inputs -->
              <div class="flex items-center gap-3">
                <div class="flex-1 flex items-center bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus-within:border-zinc-900">
                  <span class="text-xs text-zinc-400 mr-2 shrink-0">时</span>
                  <input v-model.number="hour" type="number" min="0" max="23" class="w-full bg-transparent text-xs font-mono font-bold text-zinc-900 text-center outline-none" @change="setTime(hour || 0, minute)" />
                </div>
                <span class="text-zinc-300 font-bold">:</span>
                <div class="flex-1 flex items-center bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus-within:border-zinc-900">
                  <span class="text-xs text-zinc-400 mr-2 shrink-0">分</span>
                  <input v-model.number="minute" type="number" min="0" max="59" class="w-full bg-transparent text-xs font-mono font-bold text-zinc-900 text-center outline-none" @change="setTime(hour, minute || 0)" />
                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" class="h-10 px-4 text-xs rounded-xl" @click="selectToday">回到今天</Button>
              <div class="flex items-center gap-2">
                <Button variant="outline" class="h-10 px-4 text-xs rounded-xl" @click="open = false">取消</Button>
                <Button class="h-10 px-5 text-xs rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-md" @click="confirm">确定</Button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active { transition: opacity 0.2s ease; }
.fade-scale-enter-active > div,
.fade-scale-leave-active > div { transition: transform 0.25s ease, opacity 0.2s ease; }
.fade-scale-enter-from,
.fade-scale-leave-to { opacity: 0; }
.fade-scale-enter-from > div,
.fade-scale-leave-to > div { opacity: 0; transform: scale(0.96); }
</style>
