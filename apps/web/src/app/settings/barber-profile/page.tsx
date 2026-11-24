'use client'

import { useEffect } from 'react'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

// Old link: the barber profile lives on /profile now.
export default function BarberProfileSettingsPage() {
  const { replace: safeReplace } = useSafeNavigation();
  useEffect(() => {
    safeReplace('/profile');
  }, [safeReplace])
  return null
} 