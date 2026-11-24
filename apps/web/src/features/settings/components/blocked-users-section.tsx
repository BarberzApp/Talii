'use client'

import { useEffect, useState } from 'react'
import type { BlockEntry } from '@barber-app/shared'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, errorMessage } from '@/shared/lib/api'

/** GET /api/blocks and DELETE /api/blocks/:userId: people the user has blocked. */
export function BlockedUsersSection() {
  const [blocks, setBlocks] = useState<BlockEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    setError(null)
    try {
      const { blocks: rows } = await api.blocks.list()
      setBlocks(rows)
    } catch (err) {
      setError(errorMessage(err, 'Could not load the people you blocked.'))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const unblock = async (entry: BlockEntry) => {
    const label = entry.name || (entry.username ? `@${entry.username}` : 'this person')
    if (!window.confirm(`Unblock ${label}? You will be able to see each other again.`)) return
    setBusyId(entry.userId)
    try {
      await api.blocks.unblock(entry.userId)
      setBlocks((prev) => (prev ?? []).filter((b) => b.userId !== entry.userId))
      toast({ title: 'Unblocked', description: `${label} can see you again.` })
    } catch (err) {
      toast({ title: 'Could not unblock', description: errorMessage(err, 'Please try again.'), variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="blocked-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 id="blocked-heading" className="text-lg font-semibold text-foreground">Blocked accounts</h2>
      <p className="mt-1 text-sm text-muted-foreground">People you block cannot see you, and you do not see them.</p>
      <div className="mt-4">
        {error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        ) : blocks === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-label="Loading" />
        ) : blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-border">
            {blocks.map((entry) => (
              <li key={entry.userId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{entry.name || 'Talii user'}</p>
                  {entry.username && <p className="text-sm text-muted-foreground truncate">@{entry.username}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => void unblock(entry)} disabled={busyId === entry.userId}>
                  {busyId === entry.userId ? 'Unblocking...' : 'Unblock'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
