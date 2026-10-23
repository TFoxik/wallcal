import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/wallcal/docs/',
  title: 'WallCal',
  description: 'A Home Assistant calendar card for wall tablets — with the moon, the weather and cycle tracking built in.',
  lang: 'en',
  cleanUrls: true,
  // Only the visible one of each light/dark picture pair is fetched.
  markdown: { image: { lazyLoading: true } },
  appearance: 'dark',
  srcExclude: ['superpowers/**', 'guide.md', 'configuration.md'],
  // VitePress allow-lists the whole repo for its dev server, so deny the dev Home Assistant config (its .storage holds
  // auth tokens) and local tool state. package.json overrides vitepress 1.6's Vite 5 (unpatched dev-server advisories) with Vite 6.
  vite: { server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/dev/ha/config/**', '**/.claude/**', '**/.superpowers/**'] } } },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/wallcal/docs/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/start/install' },
      { text: 'Card map', link: '/card-map' },
      { text: 'Options', link: '/reference/options' },
      { text: 'Home page', link: 'https://tfoxik.github.io/wallcal/' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/TFoxik/wallcal' }],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Install', link: '/start/install' },
          { text: 'Your first card', link: '/start/first-card' },
        ],
      },
      { text: 'Find a setting', items: [{ text: 'Card map', link: '/card-map' }] },
      {
        text: 'Parts of the card',
        items: [
          { text: 'Top bar', link: '/parts/top-bar' },
          { text: 'Day header', link: '/parts/day-header' },
          { text: 'Events', link: '/parts/events' },
          { text: 'Floating cards', link: '/parts/floating-cards' },
        ],
      },
      {
        text: 'Look',
        items: [
          { text: 'Themes', link: '/look/themes' },
          { text: 'Colours, fonts & sizes', link: '/look/style' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Kitchen tablet', link: '/recipes/kitchen-tablet' },
          { text: 'Bedroom (night)', link: '/recipes/bedroom-night' },
          { text: 'Family with name days', link: '/recipes/family-name-days' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'All options', link: '/reference/options' },
          { text: 'Wall tablet tips', link: '/reference/wall-tablet' },
          { text: 'Troubleshooting', link: '/reference/troubleshooting' },
        ],
      },
    ],
    outline: { level: [2, 3] },
    footer: { message: 'MIT licence', copyright: 'WallCal' },
  },
});
