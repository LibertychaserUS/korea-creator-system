<template>
  <ScreenFrame testid="screen-c-creator" :title="item.displayName || '达人详情'">
    <p>粉丝 {{ item.followers }} · 评分 {{ item.rating }} · 报价 {{ item.price?.amountMin }}</p>
    <p>分类 {{ (item.categories || []).join(' / ') }}</p>
    <p>合作 {{ item.hasCollaborated ? item.collabBrands?.join(', ') : '尚未合作' }}</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const route = useRoute()
const { request } = useApi()
const item = ref<any>({})
onMounted(async () => {
  item.value = await request(`/api/select/creators/${route.params.id}`)
})
</script>
