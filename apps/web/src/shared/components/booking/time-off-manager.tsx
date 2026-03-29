"use client"

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Loader2, Info, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface TimeOff {
  id: string
  start_date: string
  end_date: string
  reason: string
}

interface TimeOffManagerProps {
  timeOff: TimeOff[]
  onAdd: (timeOff: Omit<TimeOff, 'id'>) => void
  onRemove: (id: string) => void
}

export function TimeOffManager({ timeOff: timeOffEntries, onAdd, onRemove }: TimeOffManagerProps) {
  const [newTimeOff, setNewTimeOff] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  })
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!newTimeOff.startDate || !newTimeOff.endDate) return
    setIsAdding(true)
    await onAdd({
      start_date: newTimeOff.startDate,
      end_date: newTimeOff.endDate,
      reason: newTimeOff.reason
    })
    setNewTimeOff({ startDate: '', endDate: '', reason: '' })
    setIsAdding(false)
  }

  const handleDelete = (id: string) => {
    onRemove(id)
  }

  return (
    <div className="space-y-8">
      {/* Unified Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
          <CalendarIcon className="h-8 w-8 text-secondary" />
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">Time Off</h2>
          <p className="text-foreground/70 text-lg mt-2">Schedule your breaks and personal time away</p>
        </div>
      </div>

      {/* Add Form */}
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/20 rounded-xl">
                <Plus className="h-5 w-5 text-secondary" />
              </div>
              <CardTitle className="text-2xl font-bebas text-foreground tracking-wide">Schedule Time Off</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-3">
              <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon className="h-3 w-3 text-secondary" />
                Start Date
              </Label>
              <Input
                type="date"
                value={newTimeOff.startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTimeOff({ ...newTimeOff, startDate: e.target.value })}
                className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-12 text-base transition-all"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon className="h-3 w-3 text-secondary" />
                End Date
              </Label>
              <Input
                type="date"
                value={newTimeOff.endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTimeOff({ ...newTimeOff, endDate: e.target.value })}
                className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-12 text-base transition-all"
              />
            </div>
            <div className="space-y-3 md:col-span-2 lg:col-span-1">
              <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Info className="h-3 w-3 text-secondary" />
                Reason (Optional)
              </Label>
              <Input
                placeholder="e.g. Vacation, Doctor appt"
                value={newTimeOff.reason}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTimeOff({ ...newTimeOff, reason: e.target.value })}
                className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary rounded-xl h-12 text-base transition-all"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={isAdding || !newTimeOff.startDate || !newTimeOff.endDate}
              className="w-full bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-bold shadow-xl rounded-xl h-12 text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : "Schedule Time Off"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Time Off Entries */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bebas text-foreground tracking-wide flex items-center gap-3 ml-2">
          Scheduled Periods
          <span className="text-xs font-semibold bg-secondary/20 text-secondary px-3 py-1 rounded-full uppercase tracking-widest">
            {timeOffEntries.length} Total
          </span>
        </h3>
        {timeOffEntries.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-3xl">
            <CalendarIcon className="h-10 w-10 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-medium">No time off scheduled yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {timeOffEntries.map((entry) => (
              <div
                key={entry.id}
                className="group relative bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-xl rounded-2xl p-6 hover:bg-white/10 hover:border-secondary/30 transition-all duration-300 shadow-xl"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                        <CalendarIcon className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="font-bebas text-xl tracking-wide text-foreground">
                        {format(parseISO(entry.start_date), 'MMM d, yyyy')} - {format(parseISO(entry.end_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {entry.reason && (
                      <div className="flex items-center gap-2 text-foreground/60 text-sm pl-9">
                        <Info className="h-3 w-3" />
                        {entry.reason}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400 p-2 rounded-xl h-10 w-10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
