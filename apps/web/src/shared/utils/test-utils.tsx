/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Fix testing library imports

// import React, { ReactElement } from 'react'
// import { render, RenderOptions } from '@testing-library/react'
// import { ThemeProvider } from '@/shared/components/theme/ThemeProvider'
// import { DataProvider } from '@/shared/contexts/data-context'

// Mock providers for testing
// const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
//   return (
//     <ThemeProvider
//       attribute="class"
//       defaultTheme="system"
//       enableSystem
//       disableTransitionOnChange
//     >
//       <DataProvider>
//         {children}
//       </DataProvider>
//     </ThemeProvider>
//   )
// }

// const customRender = (
//   ui: ReactElement,
//   options?: Omit<RenderOptions, 'wrapper'>
// ) => render(ui, { wrapper: AllTheProviders, ...options })

// Test helpers
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export const mockSupabaseResponse = (data: any, error: any = null) => {
  return Promise.resolve({ data, error })
}

export const mockStripeResponse = (data: any, error: any = null) => {
  return Promise.resolve({ data, error })
}

// Re-export everything
export * from '@testing-library/react'
