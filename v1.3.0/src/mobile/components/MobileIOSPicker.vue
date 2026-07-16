<script setup lang="ts">
/**
 * iOS 风格日期/时间选择器组件
 * 点击触发器单元格 → 弹出底部滚轮选择器（模拟 iOS 原生 Picker）
 */
import { ref, computed } from 'vue'
import { DatePicker, TimePicker, Popup } from 'vant'

type PickerType = 'date' | 'time' | 'datetime'

const props = withDefaults(defineProps<{
  modelValue: string
  type?: PickerType
  label: string
  placeholder?: string
  minDate?: Date
  maxDate?: Date
}>(), {
  type: 'date',
  placeholder: '请选择',
  minDate: () => new Date(2020, 0, 1),
  maxDate: () => new Date(2030, 11, 31),
})

const emit = defineEmits(['update:modelValue'])

const showPicker = ref(false)

// ── 当前日期值（DatePicker 用 string[]） ──
const datePickerValue = ref<string[]>(defaultDateValues())

// ── 当前时间值（TimePicker 用 string[]） ──
const timePickerValue = ref<string[]>(['08', '00'])

// ── datetime 模式：拆分为日期 + 时间 ──
const dtDatePart = ref<string>('')
const dtTimePart = ref<string>('08:00')
const dtShowTimePicker = ref(false)

const showDatePicker = computed(() =>
  props.type === 'date' || (props.type === 'datetime' && !dtShowTimePicker.value)
)

const showTimePicker = computed(() =>
  props.type === 'time' || (props.type === 'datetime' && dtShowTimePicker.value)
)

const title = computed(() => {
  if (props.type === 'time') return `选择${props.label.replace(/[:：]$/, '')}`
  if (props.type === 'datetime' && dtShowTimePicker.value) return '选择时间'
  return '选择日期'
})

const leftButtonText = computed(() =>
  props.type === 'datetime' && dtShowTimePicker.value ? '上一步' : '取消'
)

// ── 显示文本 ──
const displayText = computed(() => {
  if (!props.modelValue) return ''
  if (props.type === 'date') return props.modelValue
  if (props.type === 'time') return props.modelValue
  // datetime
  return props.modelValue.replace('T', ' ').slice(0, 16)
})

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultDateValues(): string[] {
  return todayStr().split('-')
}

function parseDateToValues(dateStr: string): string[] {
  if (!dateStr) return defaultDateValues()
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return [parts[0], parts[1].padStart(2, '0'), parts[2].padStart(2, '0')]
  }
  return defaultDateValues()
}

function parseTimeToValues(timeStr: string): string[] {
  if (!timeStr) return ['08', '00']
  const [h, m] = timeStr.split(':')
  return [h ? h.padStart(2, '0') : '08', m ? m.padStart(2, '0') : '00']
}

function openPicker() {
  if (props.type === 'date') {
    datePickerValue.value = parseDateToValues(props.modelValue)
  } else if (props.type === 'time') {
    timePickerValue.value = parseTimeToValues(props.modelValue)
  } else if (props.type === 'datetime') {
    if (props.modelValue) {
      const [datePart, timePart] = props.modelValue.split('T')
      dtDatePart.value = datePart || todayStr()
      dtTimePart.value = timePart ? timePart.slice(0, 5) : '08:00'
    } else {
      dtDatePart.value = todayStr()
      dtTimePart.value = '08:00'
    }
    datePickerValue.value = parseDateToValues(dtDatePart.value)
    timePickerValue.value = parseTimeToValues(dtTimePart.value)
    dtShowTimePicker.value = false
  }
  showPicker.value = true
}

function onDateConfirm() {
  const dateStr = datePickerValue.value.join('-')
  if (props.type === 'date') {
    emit('update:modelValue', dateStr)
    showPicker.value = false
  } else if (props.type === 'datetime') {
    dtDatePart.value = dateStr
    dtShowTimePicker.value = true
  }
}

function onTimeConfirm() {
  const timeStr = timePickerValue.value.join(':')
  if (props.type === 'time') {
    emit('update:modelValue', timeStr)
    showPicker.value = false
  } else if (props.type === 'datetime') {
    dtTimePart.value = timeStr
    const result = `${dtDatePart.value}T${timeStr}`
    emit('update:modelValue', result)
    showPicker.value = false
  }
}

function onConfirm() {
  if (showDatePicker.value) {
    onDateConfirm()
  } else {
    onTimeConfirm()
  }
}

function onCancel() {
  if (props.type === 'datetime' && dtShowTimePicker.value) {
    dtShowTimePicker.value = false
  } else {
    showPicker.value = false
  }
}
</script>

<template>
  <div class="ios-picker">
    <div class="ios-picker__cell" @click="openPicker">
      <span class="ios-picker__label">{{ label }}</span>
      <div class="ios-picker__right">
        <span class="ios-picker__value" :class="{ 'is-placeholder': !displayText }">
          {{ displayText || placeholder }}
        </span>
        <svg class="ios-picker__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </div>

    <Popup
      v-model:show="showPicker"
      position="bottom"
      round
      teleport="body"
      :close-on-click-overlay="true"
    >
      <div class="ios-picker__toolbar">
        <span class="ios-picker__btn ios-picker__btn--cancel" @click="onCancel">
          {{ leftButtonText }}
        </span>
        <span class="ios-picker__title">{{ title }}</span>
        <span class="ios-picker__btn ios-picker__btn--confirm" @click="onConfirm">
          确认
        </span>
      </div>

      <DatePicker
        v-if="showDatePicker"
        v-model="datePickerValue"
        :min-date="minDate"
        :max-date="maxDate"
        :show-toolbar="false"
      />

      <TimePicker
        v-if="showTimePicker"
        v-model="timePickerValue"
        :show-toolbar="false"
      />
    </Popup>
  </div>
</template>

<style scoped>
.ios-picker {
  width: 100%;
}

.ios-picker__cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  cursor: pointer;
  min-height: 44px;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.ios-picker__cell:active {
  background: var(--color-border-light);
}

.ios-picker__label {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-2);
  flex-shrink: 0;
}

.ios-picker__right {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ios-picker__value {
  font-size: 15px;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ios-picker__value.is-placeholder {
  color: var(--color-text-4);
}

.ios-picker__chevron {
  width: 16px;
  height: 16px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.ios-picker__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

.ios-picker__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.ios-picker__btn {
  font-size: 15px;
  font-weight: 500;
  padding: 4px 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ios-picker__btn--cancel {
  color: var(--color-text-3);
}

.ios-picker__btn--confirm {
  color: var(--color-primary);
}
</style>
