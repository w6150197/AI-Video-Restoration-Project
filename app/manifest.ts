import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HCCTV Video Restoration Tool',
    short_name: 'HCCTV Restore',
    description: 'AI-powered lens spot removal for HCC TV video footage',
    start_url: '/',
    display: 'standalone',
    background_color: '#002C72',
    theme_color: '#002C72',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
