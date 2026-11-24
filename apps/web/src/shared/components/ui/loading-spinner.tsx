import { cn } from '@/shared/lib/utils'

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

  return (
    <div role="status" aria-label={text || 'Loading'} className={cn('flex flex-col items-center justify-center space-y-4', className)}>
      <div className="relative flex items-center justify-center" style={{ width: sizeMap[size], height: sizeMap[size] }}>
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
    </div>
  )
} 