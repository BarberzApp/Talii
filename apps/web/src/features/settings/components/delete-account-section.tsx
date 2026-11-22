'use client'

import { useState, type ChangeEvent } from 'react'
import type { DeleteMeConflict } from '@barber-app/shared'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, errorMessage, hasErrorCode } from '@/shared/lib/api'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

/**
 * Account deletion (DELETE /api/me), same rules as the mobile app: the user
 * types DELETE to confirm; upcoming bookings are cancelled under the normal
 * refund policy; booking and payment history stays on the server.
 */
export function DeleteAccountSection({ isBarber }: { isBarber: boolean }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { logout } = useAuth()
  const { replace } = useSafeNavigation()

  const confirmed = confirmText.trim() === 'DELETE'

  const handleDelete = async () => {
    if (!confirmed) return
    setDeleting(true)
    setError(null)
    try {
      await api.me.delete()
      setOpen(false)
      await logout()
      toast({ title: 'Account deleted', description: 'Your Talii account has been deleted.' })
      replace('/')
    } catch (err) {
      if (hasErrorCode(err, 'HAS_UPCOMING_BOOKINGS')) {
        const details = err.details as Partial<DeleteMeConflict> | undefined
        const remaining = details?.bookings?.length ?? 0
        const cancelled = details?.cancelledBookings?.length ?? 0
        setError(
          `Your account was not deleted: ${remaining} upcoming booking${remaining === 1 ? '' : 's'} could not be cancelled` +
            (cancelled ? ` (${cancelled} other${cancelled === 1 ? ' was' : 's were'} cancelled)` : '') +
            '. Cancel them from your calendar, then try again.'
        )
      } else {
        setError(errorMessage(err, 'Could not delete your account. Please try again.'))
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section aria-labelledby="delete-account-heading" className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 p-5 sm:p-6">
      <h2 id="delete-account-heading" className="text-lg font-semibold text-foreground">Delete account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete your Talii account. Upcoming bookings are cancelled first
        {isBarber ? ' (your clients get their booking fee back) and your booking page is taken down.' : '; a booking cancelled less than 24 hours before it starts does not get its booking fee back.'}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => { setConfirmText(''); setError(null); setOpen(true) }}
        className="mt-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete my account
      </Button>

      <AlertDialog open={open} onOpenChange={(next: boolean) => { if (!deleting) setOpen(next) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your profile{isBarber ? ', booking page, services and photos' : ' and photos'} will be removed and you will be signed out.
              Past bookings and payments are kept for the other person&apos;s records, without your name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep my account</AlertDialogCancel>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={!confirmed || deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {deleting ? 'Deleting...' : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
