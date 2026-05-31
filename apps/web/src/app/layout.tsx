import type { Metadata } from 'next'
import { Geist_Mono, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/src/lib/auth-context'
import { ServerStatusProvider } from '@/src/lib/server-status'
import './globals.css'

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata: Metadata = {
  title: 'inferr',
  description: 'Your AI-powered developer feed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistMono.variable} ${dmSans.variable}`}>
      <body>
        <ServerStatusProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ServerStatusProvider>
        <Analytics />
      </body>
    </html>
  )
}
