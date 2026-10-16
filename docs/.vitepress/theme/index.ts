import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import PartMap from './PartMap.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PartMap', PartMap);
  },
} satisfies Theme;
