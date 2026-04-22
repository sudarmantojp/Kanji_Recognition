import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Kanji Scanner - Furigana Reader',
  description: 'Scan Japanese kanji with your camera and see furigana readings instantly',
  generator: 'Blackbox AI',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="bg-background">
      <head>
        {/* kuromoji.js — Japanese morphological analyzer, loaded as global window.kuromoji */}
        {/* Used as fallback tokenizer when AI furigana is unavailable */}
        <script
          src="https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js"
          async
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
