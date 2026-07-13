/**
 * P1-05: H5 移动端统一对话框 composable
 * 替代原生 confirm()/alert()，提供基于 ConfirmDialog 的 Promise 接口
 */
import { ref } from 'vue'

interface DialogState {
  visible: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  type: 'danger' | 'warning' | 'info'
  resolve: ((value: boolean) => void) | null
}

const state = ref<DialogState>({
  visible: false,
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  type: 'warning',
  resolve: null,
})

/** Promise-based confirm dialog */
export function h5Confirm(message: string, title = '确认操作'): Promise<boolean> {
  return new Promise((resolve) => {
    // If a dialog is already open, close it first
    if (state.value.visible && state.value.resolve) {
      state.value.resolve(false)
    }
    state.value = {
      visible: true,
      title,
      message,
      confirmText: '确认',
      cancelText: '取消',
      type: 'warning',
      resolve,
    }
  })
}

/** Promise-based alert dialog (only confirm button) */
export function h5Alert(message: string, title = '提示'): Promise<void> {
  return new Promise((resolve) => {
    if (state.value.visible && state.value.resolve) {
      state.value.resolve(false)
    }
    state.value = {
      visible: true,
      title,
      message,
      confirmText: '知道了',
      cancelText: '',
      type: 'info',
      resolve: () => resolve(),
    }
  })
}

export function useH5Dialog() {
  function onConfirm() {
    state.value.visible = false
    if (state.value.resolve) {
      state.value.resolve(true)
      state.value.resolve = null
    }
  }

  function onCancel() {
    state.value.visible = false
    if (state.value.resolve) {
      state.value.resolve(false)
      state.value.resolve = null
    }
  }

  return {
    state,
    onConfirm,
    onCancel,
  }
}
