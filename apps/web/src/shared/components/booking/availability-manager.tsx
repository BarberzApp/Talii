"use client"

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { WeeklySchedule } from './weekly-schedule'
import { SpecialHoursManager, type SpecialHours } from './special-hours-manager'

import { api, errorMessage } from '@/shared/lib/api'
import { localDateInTimeZone, type SpecialHoursRow } from '@barber-app/shared'
import { toast as showToast } from '@/shared/components/ui/use-toast'
import { Loader2, Calendar, Clock, Settings } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { logger } from '@/shared/lib/logger'

interface Availability {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
}

interface AvailabilityManagerProps {
  barberId: string
  onUpdate?: () => void
}

function toManagerRow(row: SpecialHoursRow): SpecialHours {
  return {
    id: row.id,
    date: row.date,
    start_time: row.start_time?.slice(0, 5) ?? '',
    end_time: row.end_time?.slice(0, 5) ?? '',
    is_closed: row.is_closed,
    reason: row.reason ?? '',
  }
}

/**
 * Weekly hours (GET/PUT /api/me/availability) and per-date overrides
 * (GET/PUT/DELETE /api/me/special-hours). A closed special-hours day replaces
 * the old "time off".
 */
export function AvailabilityManager({ barberId, onUpdate }: AvailabilityManagerProps) {
  const [activeTab, setActiveTab] = useState('weekly')
  const [loading, setLoading] = useState(true)
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])

  useEffect(() => {
    fetchAvailability()
  }, [barberId])

  const fetchAvailability = async () => {
    try {
      setLoading(true)
      // "Today" in the barber's time zone, not UTC.
      const me = await api.me.get()
      const today = localDateInTimeZone(new Date(), me.barber?.timezone ?? 'America/New_York')
      const [{ availability: week }, { specialHours: overrides }] = await Promise.all([
        api.schedule.getWeek(),
        api.schedule.listSpecialHours({ from: today }),
      ])
      setAvailability(week)
      setSpecialHours(overrides.map(toManagerRow))
    } catch (error) {
      logger.error('Error fetching availability', error)
      showToast({ title: 'Could not load your schedule', description: errorMessage(error, 'Please refresh the page.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleAddSpecialHours = async (hours: Omit<SpecialHours, 'id'>) => {
    try {
      setLoading(true)
      const reason = hours.reason?.trim() || null
      const result = await api.schedule.putSpecialHours(
        hours.is_closed
          ? { date: hours.date, isClosed: true, reason }
          : { date: hours.date, isClosed: false, startTime: hours.start_time, endTime: hours.end_time, reason }
      )
      setSpecialHours((prev) =>
        [...prev.filter((h) => h.date !== hours.date), toManagerRow(result.specialHours)].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      )
      if (result.bookingsOutsideHours.length > 0) {
        showToast({
          title: 'Special hours saved',
          description: `${result.bookingsOutsideHours.length} existing booking(s) fall outside these hours and were kept. To cancel one, open it in your Calendar (the client's booking fee is refunded in full).`,
          variant: 'warning',
        })
      } else {
        showToast({ title: 'Special hours saved' })
      }
      onUpdate?.()
    } catch (error) {
      logger.error('Error adding special hours', error)
      showToast({ title: 'Could not save special hours', description: errorMessage(error, 'Please try again.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveSpecialHours = async (id: string) => {
    const entry = specialHours.find((h) => h.id === id)
    if (!entry) return
    try {
      setLoading(true)
      await api.schedule.deleteSpecialHours(entry.date)
      setSpecialHours((prev) => prev.filter((h) => h.id !== id))
      showToast({ title: 'Special hours removed' })
      onUpdate?.()
    } catch (error) {
      logger.error('Error removing special hours', error)
      showToast({ title: 'Could not remove special hours', description: errorMessage(error, 'Please try again.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
              <Settings className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">Schedule Management</h2>
              <p className="text-foreground/70 text-lg mt-2">Manage your weekly hours and special hours (mark a date closed for time off)</p>
            </div>
          </div>
        </div>
        <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-secondary mx-auto" />
                <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
              </div>
              <p className="text-foreground/60 text-lg font-medium">Loading availability settings...</p>
              <p className="text-foreground/40 text-sm">Please wait while we fetch your schedule data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
            <Settings className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">Schedule Management</h2>
            <p className="text-foreground/70 text-lg mt-2">Manage your weekly hours and special hours (mark a date closed for time off)</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-black/5 dark:border-white/10 bg-gradient-to-r from-secondary/10 to-transparent backdrop-blur-[40px]">
              <TabsList className="grid w-full grid-cols-2 bg-transparent border-0 p-2 h-auto gap-2">
                <TabsTrigger 
                  value="weekly" 
                  className={`relative flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-4 rounded-xl transition-all duration-200 text-sm font-semibold ${
                    activeTab === 'weekly' 
                      ? 'bg-secondary text-secondary-foreground shadow-lg' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  <span>Weekly<span className="hidden sm:inline"> Schedule</span></span>
                </TabsTrigger>
                <TabsTrigger 
                  value="special-hours" 
                  className={`relative flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-4 rounded-xl transition-all duration-200 text-sm font-semibold ${
                    activeTab === 'special-hours' 
                      ? 'bg-secondary text-secondary-foreground shadow-lg' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  <span>Special<span className="hidden sm:inline"> Hours</span></span>
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="p-4 sm:p-8">
              <TabsContent value="weekly" className="m-0">
                <WeeklySchedule
                  barberId={barberId}
                  initialSchedule={availability}
                  onUpdate={onUpdate}
                />
              </TabsContent>
              <TabsContent value="special-hours" className="m-0">
                <SpecialHoursManager
                  specialHours={specialHours}
                  onAdd={handleAddSpecialHours}
                  onRemove={handleRemoveSpecialHours}
                  barberId={barberId}
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}