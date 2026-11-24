'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

/**
 * Sends a Supabase password-reset email. The link opens /reset-password,
 * which must be listed in the Supabase project's allowed redirect URLs.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      // Supabase does not say whether the address has an account; neither do we.
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      logger.error('Password reset request failed', err)
      const status = (err as { status?: number })?.status
      setError(
        status === 429
          ? 'Too many reset emails were requested. Please wait a few minutes and try again.'
          : 'Could not send the reset email. Please try again in a minute.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="bg-surface/60 border border-border/50 shadow-xl rounded-[2rem] p-6 sm:p-8 w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-10 w-10 text-primary mb-2" aria-hidden="true" />
          <CardTitle className="text-3xl sm:text-4xl font-bebas font-bold text-foreground mb-2">Reset your password</CardTitle>
          <CardDescription className="text-muted-foreground">
            {sent
              ? 'If an account uses that email, we have sent it a link to choose a new password. The link works once and expires after an hour.'
              : 'Enter the email you sign in with and we will send you a reset link.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-muted border border-border text-foreground rounded-xl px-4"
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full bg-button text-button-foreground font-bold py-4 rounded-xl hover:bg-button/90 text-lg font-bebas"
              >
                {sending ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending...</span>
                ) : (
                  'Send reset link'
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
