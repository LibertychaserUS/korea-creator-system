<template>
  <ScreenFrame testid="screen-a-batch-upload" title="文件投递入库">
    <p class="muted">只打已配置的文件投递 Source，不填未登记地址。</p>
    <button class="btn" type="button" @click="run">开跑文件投递任务</button>
    <p v-if="result">任务 {{ result.id }} · {{ result.status }} · 写入 {{ result.writtenCount }}</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const result = ref<any>(null)
async function run() {
  result.value = await request('/api/ops/batches', { method: 'POST' })
}
</script>
