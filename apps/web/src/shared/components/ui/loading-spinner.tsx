import { cn } from '@/shared/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 40,
    md: 64,
    lg: 96
  }
  const logoSize = sizeMap[size] || 64

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-4', className)}>
      <div className="relative flex items-center justify-center">
        {/* Animated Glow Effect - Talii primary #EE6D23 */}
        <div 
          className="absolute inset-0 rounded-full animate-talii-glow z-0" 
          style={{ 
            filter: 'blur(32px)', 
            background: 'radial-gradient(circle at 60% 40%, hsl(var(--primary)) 0%, transparent 70%)', 
            opacity: 0.3 
          }} 
        />
      </div>
      {text && (
        <p className="text-base text-primary font-semibold animate-pulse mt-2">{text}</p>
      )}
      <style jsx global>{`
        @keyframes talii-glow {
          0% { opacity: 0.7; filter: blur(16px); }
          50% { opacity: 1; filter: blur(32px); }
          100% { opacity: 0.7; filter: blur(16px); }
        }
        .animate-talii-glow {
          animation: talii-glow 2.2s ease-in-out infinite;
        }
        @keyframes talii-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
        .animate-talii-float {
          animation: talii-float 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
} 