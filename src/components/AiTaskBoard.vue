<template>
  <section class="workspace-view workspace-view--board" aria-label="AI任务看板">
    <header class="board-heading">
      <h2>AI任务进程看板</h2>
      <ArrowUpOutlined />
    </header>
    <div class="board-list">
      <article v-for="item in tasks" :key="item.id" class="board-card">
        <div class="board-card__title">
          <span><FileSearchOutlined />模板提取</span>
          <strong>{{ item.title }}</strong>
        </div>
        <p>「绩效任务名称」- 某某绩效任务</p>
        <div class="board-card__progress">
          <b><CheckCircleOutlined />已完成</b>
          <i aria-hidden="true">
            <span v-for="segment in 4" :key="segment" :class="{ 'is-complete': segment <= Math.ceil(item.progress / 25) }"></span>
          </i>
          <em>{{ item.progress }}%</em>
        </div>
        <button type="button" @click="notifyDeveloping">查看详情</button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { DIGITAL_HUMAN_BOARD_TASKS, DIGITAL_HUMAN_DEVELOPMENT_NOTICE } from '@/config/demo-config'
import { message as antMessage } from 'ant-design-vue'
import { ArrowUpOutlined, CheckCircleOutlined, FileSearchOutlined } from '@ant-design/icons-vue'

const tasks = DIGITAL_HUMAN_BOARD_TASKS
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE)
</script>

<style scoped lang="less">
.workspace-view { flex: 1; min-height: 0; overflow-y: auto; padding: 27px 22px 18px; color: #20242c; background: #fafaf8; }
.board-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 44px; }
.board-heading h2 { margin: 0; color: #20242c; font-size: 20px; font-weight: 700; letter-spacing: -.45px; }
.board-heading :deep(.anticon) { color: #3c434d; font-size: 17px; transform: rotate(45deg); }
.board-list { display: grid; gap: 22px; }
.board-card { min-height: 150px; padding: 18px 14px 15px; border: 1px solid #dcdfe4; border-radius: 8px; background: #fff; box-shadow: 0 2px 5px rgba(50, 59, 75, .045); }
.board-card__title { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 13px; }
.board-card__title span { flex: none; display: inline-flex; align-items: center; gap: 5px; color: #6086fb; font-weight: 600; }
.board-card__title span :deep(.anticon) { font-size: 14px; }
.board-card__title strong { overflow: hidden; color: #20242c; text-overflow: ellipsis; white-space: nowrap; }
.board-card p { margin: 9px 0 8px; color: #9498a0; font-size: 11px; line-height: 18px; }
.board-card__progress { display: flex; align-items: center; gap: 8px; }
.board-card__progress b { flex: none; display: inline-flex; align-items: center; gap: 4px; height: 21px; padding: 0 7px; border: 1px solid #57b7ff; border-radius: 4px; color: #48aaf5; font-size: 10px; font-weight: 500; }
.board-card__progress i { display: grid; grid-template-columns: repeat(4, 32px); gap: 3px; height: 7px; }
.board-card__progress i span { display: block; background: #edf0f3; }
.board-card__progress i span.is-complete { background: #2696ef; }
.board-card__progress em { color: #666d77; font-size: 10px; font-style: normal; }
.board-card button { margin-top: 17px; padding: 0; border: 0; background: transparent; color: #303741; font-size: 12px; font-weight: 600; cursor: pointer; }
.board-card button:hover { color: #357feb; }

@media (max-width: 430px) {
  .workspace-view { padding-right: 14px; padding-left: 14px; }
  .board-card__progress i { grid-template-columns: repeat(4, minmax(18px, 1fr)); flex: 1; }
}
</style>
