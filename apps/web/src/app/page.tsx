'use client';
import { useEffect } from 'react';
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation';

export default function HomePage() {
  const { replace: safeReplace } = useSafeNavigation();
  useEffect(() => {
    safeReplace('/landing');
  }, [safeReplace]);
  return null;
} 