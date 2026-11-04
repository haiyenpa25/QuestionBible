<script setup lang="ts">
defineProps<{
  index: number;
  sizeClass?: string;
}>();

const SHAPES = ['▲', '◆', '●', '■'];
const LABELS = ['A', 'B', 'C', 'D'];
</script>

<template>
  <span
    class="inline-flex items-center justify-center font-black select-none shrink-0"
    :class="sizeClass || 'w-10 h-10 text-2xl'"
    :aria-label="`Phương án ${LABELS[index % 4]}`"
  >
    {{ SHAPES[index % 4] }}
  </span>
</template>

