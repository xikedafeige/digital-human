<template>
  <a-modal
    :open="open"
    :title="title || '文件预览'"
    :footer="null"
    :width="780"
    centered
    :body-style="bodyStyle"
    @cancel="close"
  >
    <div class="document-preview">
      <div v-if="isLoading" class="document-preview__state">
        <span class="document-preview__spinner" aria-hidden="true"></span>
        <span>正在加载中，请耐心等待...</span>
      </div>
      <div v-else-if="errorMessage" class="document-preview__state is-error">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadPreview">重试</button>
      </div>
      <iframe
        v-else-if="previewUrl"
        class="document-preview__frame"
        :src="previewUrl"
        :title="title || '文件预览'"
      ></iframe>
      <div v-else class="document-preview__state">暂无可预览文件</div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Modal as AModal } from 'ant-design-vue'

const props = defineProps<{
  open: boolean
  title: string
  url: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const bodyStyle = {
  height: 'min(72vh, 640px)',
  padding: '0',
  overflow: 'hidden',
}
const previewUrl = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
let request: AbortController | null = null

const revokePreviewUrl = () => {
  if (previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
}

const cancelRequest = () => {
  request?.abort()
  request = null
}

const close = () => emit('update:open', false)

const loadPreview = async () => {
  cancelRequest()
  revokePreviewUrl()
  errorMessage.value = ''

  if (!props.open || !props.url.trim()) {
    isLoading.value = false
    return
  }

  const controller = new AbortController()
  request = controller
  isLoading.value = true

  try {
    const response = await fetch(props.url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit',
    })
    if (!response.ok) {
      throw new Error(`文件预览请求失败（${response.status}）`)
    }

    const blob = await response.blob()
    if (controller.signal.aborted) {
      return
    }

    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '文件预览失败'
    }
  } finally {
    if (request === controller) {
      request = null
      isLoading.value = false
    }
  }
}

watch(
  () => [props.open, props.url],
  ([open]) => {
    if (open) {
      void loadPreview()
      return
    }

    cancelRequest()
    revokePreviewUrl()
    isLoading.value = false
    errorMessage.value = ''
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cancelRequest()
  revokePreviewUrl()
})
</script>

<style scoped lang="less">
.document-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f6f8fc;
}

.document-preview__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.document-preview__state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #7b879b;
  font-size: 13px;
}

.document-preview__state.is-error {
  flex-direction: column;
  color: #d05b48;
}

.document-preview__state button {
  padding: 5px 13px;
  border: 1px solid #cbd9ef;
  border-radius: 6px;
  background: #fff;
  color: #4384e8;
  cursor: pointer;
}

.document-preview__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(93, 133, 239, 0.22);
  border-top-color: #5d85ef;
  border-radius: 50%;
  animation: document-preview-spin 0.72s linear infinite;
}

@keyframes document-preview-spin {
  to { transform: rotate(360deg); }
}
</style>
