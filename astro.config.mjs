// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.eigengrouse.com',
  integrations: [
    mdx(),
    mermaid({
      theme: 'forest',
      autoTheme: true
    })
  ],
})