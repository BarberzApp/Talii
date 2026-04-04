'use client'

import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ClientProfile } from '@/shared/components/profile/client-profile'
import { Loader2 } from 'lucide-react'
import ProfilePortfolio from '@/features/settings/components/profile-portfolio'
import ClientPortfolio from '@/shared/components/profile/client-portfolio'
import Link from 'next/link'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

export default function ProfilePage() {
  const { user, status } = useAuth()
  const router = useRouter()
  const { push: safePush } = useSafeNavigation();

  useEffect(() => {
    if (status === 'unauthenticated') {
      safePush('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 h-[85vh] bg-gradient-to-b from-secondary/[0.08] via-secondary/[0.02] to-transparent" />
          <div className="absolute top-0 right-0 w-[32rem] h-[32rem] rounded-full blur-[120px] bg-secondary/10" />
          <div className="absolute bottom-1/4 left-0 w-[24rem] h-[24rem] rounded-full blur-[120px] bg-secondary/8" />
        </div>
        
        <div className="text-center space-y-6 relative z-10">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-secondary opacity-80" />
            <div className="absolute inset-0 rounded-full bg-secondary/15 animate-ping duration-[2000ms]" />
          </div>
          <p className="text-foreground font-bebas text-2xl tracking-[0.2em] opacity-40 animate-pulse">Initializing Profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 h-[85vh] bg-gradient-to-b from-secondary/[0.08] via-secondary/[0.02] to-transparent" />
        <div className="absolute top-0 right-0 w-[42rem] h-[42rem] rounded-full blur-[140px] bg-secondary/8 animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-0 left-0 w-[36rem] h-[36rem] rounded-full blur-[140px] bg-secondary/5" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {user.role === 'barber' ? (
          <ProfilePortfolio />
        ) : (
          <ClientPortfolio />
        )}
      </div>
    </div>
  )
} 