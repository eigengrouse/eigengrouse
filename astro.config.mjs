import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import mermaid from 'astro-mermaid';
import zxbasic from './src/lang/zxbasic.tmLanguage.json'

export default defineConfig({
  site: 'https://www.eigengrouse.com',
  integrations: [
    mdx(),
    sitemap(),
    mermaid({
      theme: 'dark',
      autoTheme: true
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      langs: [
        {
          id: 'zxbasic',
          scopeName: 'source.zxbasic',
          grammar: zxbasic,
          aliases: ['zxbasic'],...zxbasic
        }
      ],
      wrap: true
    }
  }
});
