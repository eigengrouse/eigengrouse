import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import zxbasic from './src/lang/zxbasic.tmLanguage.json'
import nextbasic from './src/lang/nextbasic.tmLanguage.json'

export default defineConfig({
  site: 'https://www.eigengrouse.com',
  integrations: [
    sitemap()
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
        },
        {
          id: 'nextbasic',
          scopeName: 'source.zxbasic',
          grammar: nextbasic,
          aliases: ['nextbasic'],...nextbasic
        },
      ],
      wrap: true
    }
  }
});
