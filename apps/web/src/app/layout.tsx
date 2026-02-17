import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/shared/components/ui/toaster'
import { ThemeProvider } from "@/shared/components/theme/theme-provider"
import { TooltipProvider } from "@/shared/components/ui/tooltip"

import { EnhancedErrorBoundary } from "@/shared/components/ui/enhanced-error-boundary"
import { LoadingProvider } from "@/shared/components/ui/loading-provider"
import { SMSPopupWrapper } from "@/shared/components/ui/sms-popup-wrapper"
import { ErrorReportingProvider } from "@/shared/components/error-reporting-provider"
import { cn } from "@/shared/lib/utils"
import React from 'react'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'BOCM',
  description: 'Book your next haircut with ease',
  themeColor: '#000000',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1
  }
}

// ClientNavWrapper is a client component that handles nav visibility
const ClientNavWrapper = React.lazy(() => import('@/shared/components/layout/client-nav-wrapper'));

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn(inter.className, "bg-background min-h-screen")}> 
        <ErrorReportingProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <TooltipProvider>
            <EnhancedErrorBoundary>
              <LoadingProvider>
              <React.Suspense fallback={null}>
                <ClientNavWrapper>{children}</ClientNavWrapper>
              </React.Suspense>
              <Toaster />
              <SMSPopupWrapper />
              </LoadingProvider>
            </EnhancedErrorBoundary>
            </TooltipProvider>
          </ThemeProvider>
        </ErrorReportingProvider>
      </body>
    </html>
  )
} 