import './globals.css'

export const metadata = {
  title: 'JdB Werkbonnen',
  description: 'Werkbon beheer voor JdB Dak- & Installatietechniek',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Werkbonnen',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport = {
  themeColor: '#C9A227',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
