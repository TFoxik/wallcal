<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';

interface Dot {
  n: number;
  label: string;
  href: string;
  x: number;
  y: number;
}

interface MapData {
  dark: string;
  light: string;
  alt: string;
  width: number;
  height: number;
  dots: Dot[];
}

// Bundled at build time, so the numbered list is in the static HTML and works without JavaScript.
const maps = import.meta.glob<MapData>('../../public/img/*.json', { eager: true, import: 'default' });

const props = defineProps<{ map: string }>();
const data = computed(() => maps[`../../public/img/${props.map}.json`]);
const img = (file: string) => withBase(`/img/${file}`);
</script>

<template>
  <figure v-if="data" class="part-map">
    <div class="part-map__pic">
      <img class="dark-only" :src="img(data.dark)" :width="data.width" :height="data.height" :alt="data.alt" loading="lazy" />
      <img class="light-only" :src="img(data.light)" :width="data.width" :height="data.height" :alt="data.alt" loading="lazy" />
      <a
        v-for="d in data.dots"
        :key="d.n"
        class="part-map__dot"
        :href="withBase(d.href)"
        :style="{ left: `${d.x}%`, top: `${d.y}%` }"
        :aria-label="`${d.n}. ${d.label}`"
        :title="d.label"
        >{{ d.n }}</a
      >
    </div>
    <ol class="part-map__list">
      <li v-for="d in data.dots" :key="d.n"><a :href="withBase(d.href)">{{ d.label }}</a></li>
    </ol>
  </figure>
</template>
