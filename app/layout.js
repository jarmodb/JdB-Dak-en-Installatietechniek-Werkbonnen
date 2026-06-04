import './globals.css'

export const metadata = {
  title: 'Werkbonnen – Jordy',
  description: 'Werkbon beheer voor Jordy Loodgieter & Dakdekker',
}

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
