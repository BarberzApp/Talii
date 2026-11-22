'use client'

import { useState, type ChangeEvent } from 'react'
import type { ApiReportContentType, ApiReportReason } from '@barber-app/shared'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, errorMessage, hasErrorCode } from '@/shared/lib/api'

const REASONS: Array<{ value: ApiReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'fraud', label: 'Fraud or scam' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'violence', label: 'Violence' },
  { value: 'sexual_content', label: 'Sexual content' },
  { value: 'other', label: 'Something else' },
]

/** POST /api/reports for a profile or a review. The admin team reviews every report. */
export function ReportDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  subject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentType: ApiReportContentType
  contentId: string
  /** What is being reported, e.g. "Sharp Lines" or "this review". */
  subject: string
}) {
  const [reason, setReason] = useState<ApiReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const reset = () => {
    setReason('')
    setDetails('')
    setError(null)
  }

  const submit = async () => {
    if (!reason) {
      setError('Choose a reason.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await api.reports.create({ contentType, contentId, reason, details: details.trim() || undefined })
      toast({ title: 'Report sent', description: 'Thanks for telling us. Our team will review it.' })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(
        hasErrorCode(err, 'CANNOT_REPORT_SELF')
          ? 'You cannot report yourself.'
          : errorMessage(err, 'Could not send the report. Please try again.')
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => { if (!sending) { if (!next) reset(); onOpenChange(next) } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {subject}</DialogTitle>
          <DialogDescription>Reports are private. The person you report is not told who reported them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={(v: string) => setReason(v as ApiReportReason)}>
              <SelectTrigger id="report-reason" aria-label="Reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDetails(e.target.value)}
              placeholder="What happened?"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={submit} disabled={sending} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
