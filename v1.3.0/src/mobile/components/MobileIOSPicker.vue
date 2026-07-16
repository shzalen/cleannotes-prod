<script setup lang="ts">
/**
 * iOS 风格日期/时间选择器组件
 * 点击触发器单元格 → 弹出底部滚轮选择器（模拟 iOS 原生 Picker）
 */
import { ref, computed, watch } from 'vue'
import { DatePicker, TimePicker, Popup, Button } from 'vant'

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

// ── 日期解析 ──
function parseDate(str: string): Date | null {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

// ── 当前日期值（DatePicker 用） ──
const datePickerValue = ref<Date>(parseDate(props.modelValue) || new Date())

// ── 当前时间值（TimePicker 用） ──
const timePickerValue = ref<string>(props.modelValue || '12:00')

// ── datetime 模式：拆分为日期 + 时间 ──
const dtDatePart = ref<string>(props.type === 'datetime' ? props.modelValue.slice(0, 10) : '')
const dtTimePart = ref<string>(props.type === 'datetime' ? props.modelValue.slice(11, 16) || '12:00' : '12:00')
const dtShowTimePicker = ref(false)

watch(() => props.modelValue, (val) => {
  if (props.type === 'date') {
    const d = parseDate(val)
    if (d) datePickerValue.value = d
  } else if (props.type === 'time') {
    if (val) timePickerValue.value = val
  } else if (props.type === 'datetime') {
    if (val) {
      dtDatePart.value = val.slice(0, 10)
      dtTimePart.value = val.slice(11, 16) || '12:00'
    }
  }
})

// ── 显示文本 ──
const displayText = computed(() => {
  if (!props.modelValue) return ''
  if (props.type === 'date') return props.modelValue
  if (props.type === 'time') return props.modelValue
  // datetime
  return props.modelValue.replace('T', ' ').slice(0, 16)
})

function openPicker() {
  if (props.type === 'date') {
    const d = parseDate(props.modelValue)
    datePickerValue.value = d || new Date()
  } else if (props.type === 'time') {
    timePickerValue.value = props.modelValue || '12:00'
  } else if (props.type === 'datetime') {
    if (props.modelValue) {
      dtDatePart.value = props.modelValue.slice(0, 10)
      dtTimePart.value = props.modelValue.slice(11, 16) || '12:00'
    } else {
      dtDatePart.value = ''
      dtTimePart.value = '12:00'
    }
    dtShowTimePicker.value = false
  }
  showPicker.value = true
}

// ── 日期确认 ──
function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  const dateStr = selectedValues.join('-')
  if (props.type === 'date') {
    emit('update:modelValue', dateStr)
    showPicker.value = false
  } else if (props.type === 'datetime') {
    dtDatePart.value = dateStr
    dtShowTimePicker.value = true
  }
}

// ── 时间确认 ──
function onTimeConfirm({ selectedValues }: { selectedValues: string[] }) {
  const timeStr = selectedValues.join(':')
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

// ── datetime 模式：返回日期选择 ──
function backToDate() {
  dtShowTimePicker.value = false
}

// ── datetime 模式：日期选择后，先不关闭，切到时间选择 ──
// 已在 onDateConfirm 中处理

function clearValue() {
  emit('update:modelValue', '')
  showPicker.value = false
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
        <Button v-if="type === 'datetime' && dtShowTimePicker" plain size="small" @click="backToDate">上一步</Button>
        <Button v-else plain size="small" @click="clearValue">清除</Button>
        <span class="ios-picker__title">{{ label }}</span>
        <Button plain size="small" @click="showPicker = false">关闭</Button>
      </div>

      <!-- 日期选择 -->
      <template v-if="type === 'date'">
        <DatePicker
          v-model="datePickerValue"
          :min-date="minDate"
          :max-date="maxDate"
          @confirm="onDateConfirm"
          @cancel="showPicker = false"
        />
      </template>

      <!-- 时间选择 -->
      <template v-else-if="type === 'time'">
        <TimePicker
          v-model="timePickerValue"
          @confirm="onTimeConfirm"
          @cancel="showPicker = false"
        />
      </template>

      <!-- 日期时间选择（两步） -->
      <template v-else>
        <DatePicker
          v-if="!dtShowTimePicker"
          v-model="datePickerValue"
          :min-date="minDate"
          :max-date="maxDate"
          @confirm="onDateConfirm"
          @cancel="showPicker = false"
        />
        <TimePicker
          v-else
          v-model="dtTimePart"
          @confirm="onTimeConfirm"
          @cancel="showPicker = false"
        />
      </template>
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
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.ios-picker__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}
</style>
