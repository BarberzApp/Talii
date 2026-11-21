"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Plus, Trash2, Save, Clock, Calendar, Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, errorMessage } from '@/shared/lib/api'
import { logger } from '@/shared/lib/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

interface Availability {
  id?: string
  barber_id?: string
  day_of_week: number
  start_time: string
  end_time: string
  isAvailable?: boolean
}

interface WeeklyScheduleProps {
  barberId: string
  initialSchedule?: Availability[]
  onUpdate?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type TimeWindow = { start_time: string; end_time: string }
type DaySchedule = { day_of_week: number; isAvailable: boolean; windows: TimeWindow[] }

const DEFAULT_WINDOW: TimeWindow = { start_time: '09:00', end_time: '17:00' }

/**
 * Weekly hours: any number of windows per day (e.g. a split shift). Saving
 * replaces the whole week (PUT /api/me/availability); an empty week is allowed.
 */
export function WeeklySchedule({ barberId, initialSchedule, onUpdate }: WeeklyScheduleProps) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<DaySchedule[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const rows = initialSchedule ?? []
    setSchedule(
      DAYS.map((_, index) => {
        const windows = rows
          .filter((r) => r.day_of_week === index && r.start_time && r.end_time)
          .map((r) => ({ start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
        return { day_of_week: index, isAvailable: windows.length > 0, windows }
      })
    )
  }, [initialSchedule, barberId])

  const updateDay = (day: number, change: (d: DaySchedule) => DaySchedule) =>
    setSchedule((prev) => prev.map((d) => (d.day_of_week === day ? change(d) : d)))

  const handleToggleDay = (dayOfWeek: number) => {
    updateDay(dayOfWeek, (d) =>
      d.isAvailable
        ? { ...d, isAvailable: false }
        : { ...d, isAvailable: true, windows: d.windows.length > 0 ? d.windows : [{ ...DEFAULT_WINDOW }] }
    )
  }

  const handleTimeChange = (day: number, index: number, field: keyof TimeWindow, value: string) => {
    if (!value) return // Don't update if value is empty
    updateDay(day, (d) => ({ ...d, windows: d.windows.map((w, i) => (i === index ? { ...w, [field]: value } : w)) }))
  }

  const addWindow = (day: number) => {
    updateDay(day, (d) => {
      const last = d.windows[d.windows.length - 1]
      const next = last && last.end_time < '23:00' ? { start_time: last.end_time, end_time: '23:59' } : { ...DEFAULT_WINDOW }
      return { ...d, windows: [...d.windows, next] }
    })
  }

  const removeWindow = (day: number, index: number) => {
    updateDay(day, (d) => {
      const windows = d.windows.filter((_, i) => i !== index)
      return { ...d, windows, isAvailable: windows.length > 0 && d.isAvailable }
    })
  }

  const handleSave = async () => {
    const windows = schedule
      .filter((d) => d.isAvailable)
      .flatMap((d) => d.windows.map((w) => ({ day: d.day_of_week, ...w })))

    const bad = windows.find((w) => !w.start_time || !w.end_time || w.start_time >= w.end_time)
    if (bad) {
      toast({
        title: "Error",
        description: `Each window on ${DAYS[bad.day]} needs a start time before its end time.`,
        variant: "destructive",
      })
      return
    }
    if (windows.length === 0 && !window.confirm('Save an empty week? Clients will not be able to book you until you add hours again.')) {
      return
    }

    try {
      setIsSaving(true)
      // PUT /api/me/availability replaces the whole week in one transaction.
      await api.schedule.replaceWeek(
        windows.map((w) => ({ dayOfWeek: w.day, startTime: w.start_time.slice(0, 5), endTime: w.end_time.slice(0, 5) }))
      )
      toast({
        title: "Success",
        description: windows.length === 0 ? "Weekly schedule cleared" : "Weekly schedule updated successfully",
      })
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving availability', error)
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to save schedule"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const availableDays = schedule.filter(day => day.isAvailable).length;

  return (
    <div className="space-y-8">
      {/* Unified Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
          <Calendar className="h-8 w-8 text-secondary" />
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">Weekly Schedule</h2>
          <p className="text-foreground/70 text-lg mt-2">Manage your regular working hours and availability</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {schedule.map((slot) => (
          <div
            key={slot.day_of_week}
            className={cn(
              "rounded-2xl border transition-all duration-300 overflow-hidden group",
              slot.isAvailable 
                ? "bg-white/5 border-black/5 dark:border-white/10 shadow-xl backdrop-blur-xl" 
                : "bg-black/5 dark:bg-white/5 border-transparent opacity-60 hover:opacity-100"
            )}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
              <div className="flex items-center space-x-5">
                {/* Toggle switch */}
                <label className="relative inline-flex items-center cursor-pointer group focus:outline-none">
                  <input
                    type="checkbox"
                    checked={slot.isAvailable}
                    onChange={() => handleToggleDay(slot.day_of_week)}
                    className="sr-only peer"
                    aria-label={`Toggle ${DAYS[slot.day_of_week]}`}
                  />
                  <div className="w-14 h-7 flex items-center transition-all duration-300 rounded-full border border-black/10 dark:border-white/20 peer-checked:bg-secondary peer-checked:border-secondary/50 bg-black/10 dark:bg-white/10 peer-focus:ring-2 peer-focus:ring-secondary/50 shadow-inner group-hover:scale-105">
                    <div className={cn(
                      "w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg",
                      slot.isAvailable ? "translate-x-7 bg-primary" : "translate-x-1"
                    )} />
                  </div>
                </label>
                <div>
                  <span className={cn(
                    "font-bebas text-2xl tracking-wide transition-colors",
                    slot.isAvailable ? "text-foreground" : "text-foreground/40"
                  )}>
                    {DAYS[slot.day_of_week]}
                  </span>
                  {slot.isAvailable && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                      <p className="text-xs font-semibold text-secondary uppercase tracking-widest">Active</p>
                    </div>
                  )}
                </div>
              </div>
              {slot.isAvailable && (
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  {slot.windows.map((w, i) => (
                    <div key={i} className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="space-y-2 w-full sm:w-auto">
                        <Label htmlFor={`start-${slot.day_of_week}-${i}`} className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                          <Clock className="h-3 w-3 text-secondary" />
                          Start
                        </Label>
                        <Input
                          id={`start-${slot.day_of_week}-${i}`}
                          type="time"
                          value={w.start_time}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTimeChange(slot.day_of_week, i, 'start_time', e.target.value)}
                          className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-11 text-base transition-all"
                        />
                      </div>
                      <div className="space-y-2 w-full sm:w-auto">
                        <Label htmlFor={`end-${slot.day_of_week}-${i}`} className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                          <Clock className="h-3 w-3 text-secondary" />
                          End
                        </Label>
                        <Input
                          id={`end-${slot.day_of_week}-${i}`}
                          type="time"
                          value={w.end_time}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTimeChange(slot.day_of_week, i, 'end_time', e.target.value)}
                          className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-11 text-base transition-all"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 text-foreground/50 hover:text-red-500"
                        onClick={() => removeWindow(slot.day_of_week, i)}
                        aria-label={`Remove hours ${w.start_time}–${w.end_time} on ${DAYS[slot.day_of_week]}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-secondary"
                    onClick={() => addWindow(slot.day_of_week)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add hours
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button - settings style */}
      <div className="flex justify-center pt-6">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-bold shadow-2xl px-12 py-7 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 text-lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin mr-3" />
              Saving Schedule...
            </>
          ) : (
            <>
              <Save className="h-6 w-6 mr-3" />
              Save Weekly Schedule
            </>
          )}
        </Button>
      </div>
      <div className="mt-12">
        <Card className="bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent border border-secondary/20 shadow-xl backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
                <Sparkles className="h-8 w-8 text-secondary" />
              </div>
              <div className="space-y-4">
                <h4 className="text-2xl font-bebas text-foreground tracking-wide">Schedule Optimization Pro Tips</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <li className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0 shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
                    <span className="text-foreground/70 text-base leading-relaxed">Set realistic hours that you can consistently maintain across all seasons</span>
                  </li>
                  <li className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0 shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
                    <span className="text-foreground/70 text-base leading-relaxed">Account for peak times in your area to maximize booking potential</span>
                  </li>
                  <li className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0 shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
                    <span className="text-foreground/70 text-base leading-relaxed">Leave 15-minute buffer windows between complex services</span>
                  </li>
                  <li className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0 shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
                    <span className="text-foreground/70 text-base leading-relaxed">Regularly update hours to reflect holiday breaks or vacations</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
