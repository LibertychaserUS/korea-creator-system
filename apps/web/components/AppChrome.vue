<template>
  <div class="chrome">
    <div data-testid="locale-switch">
      <button class="btn ghost" type="button" @click="setLocale('en')">English</button>
      <button class="btn ghost" type="button" @click="setLocale('ko')">한국어</button>
      <button class="btn ghost" type="button" @click="setLocale('zh-CN')">中文</button>
    </div>
    <div data-testid="theme-toggle">
      <button class="btn ghost" type="button" @click.prevent="onDark">深色</button>
      <button class="btn ghost" type="button" @click.prevent="onLight">浅色</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { applyDocumentTheme } from '~/utils/theme'

const switchLocalePath = useSwitchLocalePath()

function setLocale(next: string) {
  navigateTo(switchLocalePath(next))
}

function onDark() {
  localStorage.setItem('kcs-ui-theme-pref', 'dark')
  applyDocumentTheme(document.documentElement, 'dark')
}

function onLight() {
  localStorage.setItem('kcs-ui-theme-pref', 'light')
  applyDocumentTheme(document.documentElement, 'light')
}
</script>
