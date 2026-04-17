import type { AvatarManifest, AvatarVisemeCode } from './avatar-types'

export const AVATAR_MANIFEST_URL = '/digital-human/avatar-manifest.json'
export const LIVE2D_CORE_SCRIPT_URL = '/vendor/live2dcubismcore.min.js'
export const AVATAR_VISEME_CODES: AvatarVisemeCode[] = ['sil', 'A', 'E', 'O', 'U', 'FV', 'L', 'MBP']

const HIYORI_RUNTIME_BASE = '/digital-human/live2d/hiyori-free/hiyori_free_en/runtime'
const POSTER_URL = '/digital-human/avatar.jpg'

export const DEFAULT_AVATAR_MANIFEST: AvatarManifest = {
  version: '2.0.0',
  runtime: 'live2d',
  coreScriptUrl: LIVE2D_CORE_SCRIPT_URL,
  modelUrl: `${HIYORI_RUNTIME_BASE}/hiyori_free_t08.model3.json`,
  textures: [`${HIYORI_RUNTIME_BASE}/hiyori_free_t08.2048/texture_00.png`],
  motions: {
    idle: {
      group: 'Idle',
      index: 0,
    },
    listening: {
      group: 'Idle',
      index: 1,
    },
    thinking: {
      group: 'Flick',
      index: 0,
    },
    speakingBase: {
      group: 'Tap',
      index: 0,
    },
  },
  expressions: [],
  layout: {
    x: 0.5,
    y: 0.98,
    scale: 0.84,
    anchorX: 0.5,
    anchorY: 1,
  },
  parameters: {
    mouthOpenY: 'ParamMouthOpenY',
    mouthForm: 'ParamMouthForm',
    angleX: 'ParamAngleX',
    angleY: 'ParamAngleY',
    angleZ: 'ParamAngleZ',
    bodyAngleX: 'ParamBodyAngleX',
    eyeBallX: 'ParamEyeBallX',
    eyeBallY: 'ParamEyeBallY',
  },
  fallbackPosterUrl: POSTER_URL,
}
