export default function manifest() {
  return {
    name: 'JdB Werkbonnen',
    short_name: 'Werkbonnen',
    description: 'Werkbon beheer voor JdB Dak- & Installatietechniek',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a1a',
    theme_color: '#C9A227',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
