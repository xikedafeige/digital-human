<template>
  <Live2DStage
    :manifest="manifest"
    :state="state"
    :speech-result="speechResult"
    :autoplay-token="autoplayToken"
    @speech-complete="emit('speech-complete')"
  />
</template>

<script setup lang="ts">
import Live2DStage from './Live2DStage.vue'
import type { AvatarManifest, AvatarState, SpeechSynthesisResult } from './avatar-types'

withDefaults(
  defineProps<{
    manifest: AvatarManifest
    state: AvatarState
    speechResult?: SpeechSynthesisResult | null
    autoplayToken?: number
    crossfadeMs?: number
  }>(),
  {
    speechResult: null,
    autoplayToken: 0,
    crossfadeMs: 160,
  }
)

const emit = defineEmits<{
  (e: 'speech-complete'): void
}>()
</script>
