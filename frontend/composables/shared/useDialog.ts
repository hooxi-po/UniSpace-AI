import { ref } from 'vue'

export interface UseDialogOptions {
  defaultVisible?: boolean
}

export function useDialog(options: UseDialogOptions = {}) {
  const { defaultVisible = false } = options

  const visible = ref(defaultVisible)

  function open() {
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  function toggle() {
    visible.value = !visible.value
  }

  return {
    visible,
    open,
    close,
    toggle,
  }
}
