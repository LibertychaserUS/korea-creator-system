<template>
  <ScreenFrame testid="screen-a-creator-form" :title="item.displayName || '达人详情'">
    <p data-testid="creator-status" :data-status="item.status">{{ item.status }}</p>
    <p data-testid="creator-key" :data-creator-key="item.creatorKey">{{ item.creatorKey }}</p>
    <a
      v-if="item.avatarKey"
      data-testid="creator-avatar-url"
      :href="avatarHref"
      :data-object-key="item.avatarKey"
    >头像</a>
    <button class="btn" data-testid="btn-publish" type="button" @click="confirming = true">发布</button>
    <button v-if="confirming" class="btn" data-testid="btn-publish-confirm" type="button" @click="publish">确认发布</button>
  </ScreenFrame>
</template>

<script setup lang="ts">
const route = useRoute()
const { request } = useApi()
const item = ref<any>({})
const confirming = ref(false)
const avatarHref = computed(() => {
  const key = item.value.avatarKey
  if (!key) return ''
  return `http://127.0.0.1:9000/kcs-assets/${key}`
})
async function load() {
  item.value = await request(`/api/ops/creators/${route.params.id}`)
}
onMounted(load)
async function publish() {
  await request(`/api/ops/creators/${route.params.id}/publish`, { method: 'POST' })
  await load()
  confirming.value = false
}
</script>
