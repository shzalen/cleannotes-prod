<script setup lang="ts">
// PDM 表重建工具 — 通过 iframe 加载独立 HTML 工具页面
// 工具页面位于 public/tools/pdm-script-generator.html，构建后作为静态资源提供
</script>

<template>
  <div class="tool-iframe-container">
    <iframe
      src="./tools/pdm-script-generator.html"
      frameborder="0"
      class="tool-iframe"
      title="PDM 表重建脚本生成工具"
    />
  </div>
</template>

<style scoped>
.tool-iframe-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.tool-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
