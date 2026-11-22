'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

const MIN_PASSWORD_LENGTH = 6 // matches sign-up (web and mobile) and Supabase's default

/**
 * Set when supabase-js reports a recovery sign-in from a PKCE ?code= link (older
 * emails). Registered when this module loads, before the client's own URL
 * exchange (a network round trip) can finish.
 */
let recoveryEventSeen = false
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryEventSeen = true
  })
}

/**
 * Opened from the password-reset email:
 * ?token_hash=…&type=recovery (supabase/templates/recovery.html; works on any device).
 * The form is shown only once this link itself has been verified. An existing
 * session in the browser is never enough, so nobody can change the password of
 * whoever is signed in on a shared browser.
 */
export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { replace } = useSafeNavigation()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const tokenHash = params.get('token_hash')
        let verified = false
        if (tokenHash && params.get('type') === 'recovery') {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
          verified = !verifyError && !!data.session
        } else if (params.get('code')) {
          // supabase-js exchanges the code itself while it starts up; wait for that.
          await supabase.auth.getSession()
          verified = recoveryEventSeen
        }
        // Keep the one-time token out of history and referrers.
        window.history.replaceState(null, '', window.location.pathname)
        setPhase(verified ? 'ready' : 'invalid')
      } catch (err) {
        logger.error('Password reset link check failed', err)
        setPhase('invalid')
      }
    })()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPhase('done')
      setTimeout(() => replace('/login'), 2000)
    } catch (err) {
      logger.error('Password update failed', err)
      const message = err instanceof Error ? err.message : ''
      setError(
        /different from the old/i.test(message)
          ? 'Choose a password you have not used before.'
          : 'Could not save your new password. Please request a new reset link.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="bg-surface/60 border border-border/50 shadow-xl rounded-[2rem] p-6 sm:p-8 w-full max-w-md">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-10 w-10 text-primary mb-2" aria-hidden="true" />
          <CardTitle className="text-3xl sm:text-4xl font-bebas font-bold text-foreground mb-2">Choose a new password</CardTitle>
          <CardDescription className="text-muted-foreground">
            {phase === 'invalid' && 'This reset link is invalid or has expired. Request a new one.'}
            {phase === 'done' && 'Your password has been changed. Taking you to sign in...'}
            {(phase === 'ready' || phase === 'checking') && 'Enter your new password twice.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phase === 'checking' && (
            <div className="flex justify-center py-6" role="status" aria-label="Checking your link">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {phase === 'done' && (
            <div className="flex justify-center py-4"><CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" /></div>
          )}
          {phase === 'invalid' && (
            <Button href="/forgot-password" className="w-full bg-secondary text-primary-foreground font-bold py-4 rounded-xl hover:bg-secondary/90 text-lg font-bebas">
              Request a new link
            </Button>
          )}
          {phase === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-foreground">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-muted border border-border text-foreground rounded-xl px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                  required
                  className="h-12 bg-muted border border-border text-foreground rounded-xl px-4"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-secondary text-primary-foreground font-bold py-4 rounded-xl hover:bg-secondary/90 text-lg font-bebas"
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span>
                ) : (
                  'Save new password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
        </CardFooter>
      </Card>
    </div>
  )
}
