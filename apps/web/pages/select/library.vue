<script setup lang="ts">
const localePath = useLocalePath()
const route = useRoute()
const project = route.query.project ? `?project=${route.query.project}` : ''
await navigateTo(localePath(`/select/pool${project}`), { replace: true })
</script>
