<script setup lang="ts">
defineProps<{
  open: boolean;
  bibleReference?: string | null;
  verseText?: string | null;
  explanation?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-label="Chiếu câu gốc Kinh Thánh"
  >
    <div
      class="relative max-w-5xl w-full rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 md:p-14 shadow-2xl text-center"
    >
      <button
        type="button"
        class="absolute top-5 right-5 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        @click="emit('close')"
      >
        Đóng (ESC)
      </button>

      <div class="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/40 px-5 py-1.5 text-amber-300 text-sm font-bold uppercase tracking-widest mb-6">
        <span>📖 Lời Chúa — Bản Truyền Thống 1925</span>
      </div>

      <blockquote
        v-if="verseText"
        class="font-serif text-2xl md:text-4xl lg:text-5xl leading-relaxed text-amber-50 font-normal italic mb-8"
      >
        “{{ verseText }}”
      </blockquote>

      <p
        v-if="bibleReference"
        class="text-xl md:text-3xl font-extrabold text-amber-400 tracking-wide mb-8"
      >
        — {{ bibleReference }} —
      </p>

      <div
        v-if="explanation"
        class="mx-auto max-w-3xl rounded-xl bg-slate-800/70 border border-slate-700 p-6 text-left"
      >
        <p class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
          Bài học & Giải thích mục vụ
        </p>
        <p class="text-base md:text-xl text-slate-200 leading-relaxed">
          {{ explanation }}
        </p>
      </div>
    </div>
  </div>
</template>

