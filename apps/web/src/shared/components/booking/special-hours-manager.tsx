"use client"

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Plus, Trash2, Calendar, Clock, AlertCircle, Sparkles, Loader2, Info } from 'lucide-react'
import { useToast } from '@/shared/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/lib/utils'

interface SpecialHours {
  id: string
  barber_id: string
  date: string
  start_time: string
  end_time: string
  is_closed: boolean
  reason: string
  created_at: string
  updated_at: string
}

interface SpecialHoursManagerProps {
  specialHours: SpecialHours[]
  onAdd: (hours: Omit<SpecialHours, 'id' | 'barber_id' | 'created_at' | 'updated_at'>) => void
  onRemove: (id: string) => void
  barberId: string
}

export function SpecialHoursManager({ specialHours: specialHoursEntries, onAdd, onRemove, barberId }: SpecialHoursManagerProps) {
  const { toast } = useToast()
  const [isAdding, setIsAdding] = useState(false)
  const [newHours, setNewHours] = useState<Omit<SpecialHours, 'id' | 'barber_id' | 'created_at' | 'updated_at'>>({
    date: '',
    start_time: '09:00',
    end_time: '17:00',
    is_closed: false,
    reason: ''
  })

  const handleAdd = async () => {
    if (!newHours.date) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive',
      })
      return
    }

    if (!newHours.is_closed && (!newHours.start_time || !newHours.end_time)) {
      toast({
        title: 'Error',
        description: 'Please set both start and end times',
        variant: 'destructive',
      })
      return
    }

    if (!newHours.is_closed && newHours.start_time >= newHours.end_time) {
      toast({
        title: 'Error',
        description: 'End time must be after start time',
        variant: 'destructive',
      })
      return
    }

    const existingDate = specialHoursEntries.find(hours => hours.date === newHours.date)
    if (existingDate) {
      toast({
        title: 'Error',
        description: 'Special hours already exist for this date',
        variant: 'destructive',
      })
      return
    }

    setIsAdding(true)
    await onAdd(newHours)
    setNewHours({
      date: '',
      start_time: '09:00',
      end_time: '17:00',
      is_closed: false,
      reason: ''
    })
    setIsAdding(false)
  }

  return (
    <div className="space-y-8">
      {/* Unified Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
          <Clock className="h-8 w-8 text-secondary" />
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">Special Hours</h2>
          <p className="text-foreground/70 text-lg mt-2">Adjust your availability for specific dates or events</p>
        </div>
      </div>

      {/* Add Form Card */}
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/20 rounded-xl">
                <Plus className="h-5 w-5 text-secondary" />
              </div>
              <CardTitle className="text-2xl font-bebas text-foreground tracking-wide">Override Normal Schedule</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Calendar className="h-3 w-3 text-secondary" />
                Date
              </Label>
              <Input
                type="date"
                value={newHours.date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHours({ ...newHours, date: e.target.value })}
                className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-12 text-base transition-all"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Info className="h-3 w-3 text-secondary" />
                Reason
              </Label>
              <Input
                placeholder="e.g. Holiday, Special Event"
                value={newHours.reason}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHours({ ...newHours, reason: e.target.value })}
                className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary rounded-xl h-12 text-base transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-6 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 group active:scale-[0.99] transition-all">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl transition-colors duration-300",
                newHours.is_closed ? "bg-red-500/20" : "bg-green-500/20"
              )}>
                <AlertCircle className={cn(
                  "h-5 w-5 transition-colors duration-300",
                  newHours.is_closed ? "text-red-400" : "text-green-400"
                )} />
              </div>
              <div>
                <p className="font-bebas text-xl tracking-wide text-foreground">Closed for the day</p>
                <p className="text-sm text-foreground/60">Toggle this if you're completely unavailable</p>
              </div>
            </div>
            <Switch
              checked={newHours.is_closed}
              onCheckedChange={(checked: boolean) => setNewHours({ ...newHours, is_closed: checked })}
              className="data-[state=checked]:bg-red-500"
            />
          </div>

          {!newHours.is_closed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="space-y-3">
                <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-3 w-3 text-secondary" />
                  Start Time
                </Label>
                <Input
                  type="time"
                  value={newHours.start_time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHours({ ...newHours, start_time: e.target.value })}
                  className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-12 text-base"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-3 w-3 text-secondary" />
                  End Time
                </Label>
                <Input
                  type="time"
                  value={newHours.end_time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHours({ ...newHours, end_time: e.target.value })}
                  className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground focus:border-secondary rounded-xl h-12 text-base"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleAdd}
            disabled={isAdding || !newHours.date}
            className="w-full bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-bold shadow-xl rounded-xl h-14 text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isAdding ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <Plus className="h-6 w-6 mr-3" />}
            {isAdding ? "Saving..." : "Set Special Hours"}
          </Button>
        </CardContent>
      </Card>

      {/* Current Entries */}
      <div className="space-y-4 pt-4">
        <h3 className="text-2xl font-bebas text-foreground tracking-wide flex items-center gap-3 ml-2">
          Special Exceptions
          <span className="text-xs font-semibold bg-secondary/20 text-secondary px-3 py-1 rounded-full uppercase tracking-widest">
            {specialHoursEntries.length} Saved
          </span>
        </h3>
        {specialHoursEntries.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-3xl">
            <Sparkles className="h-10 w-10 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-medium">No special hours defined yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specialHoursEntries.map((hours) => (
              <div
                key={hours.id}
                className="group relative bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-xl rounded-2xl p-6 hover:bg-white/10 hover:border-secondary/30 transition-all duration-300 shadow-xl"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                        <Calendar className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="font-bebas text-xl tracking-wide text-foreground">
                        {new Date(hours.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </div>
                      {hours.is_closed ? (
                        <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-red-500/20">
                          Closed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-green-500/20">
                          Modified
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 pl-9">
                      {hours.is_closed ? (
                        <div className="flex items-center gap-2 text-red-400/80 text-sm italic">
                          <AlertCircle className="h-3 w-3" />
                          Availability removed for this date
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg text-sm text-foreground/60">
                          <Clock className="h-3 w-3 text-secondary" />
                          {hours.start_time} - {hours.end_time}
                        </div>
                      )}
                    </div>

                    {hours.reason && (
                      <div className="flex items-center gap-2 text-foreground/40 text-xs pl-9 italic">
                        "{hours.reason}"
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(hours.id)}
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
