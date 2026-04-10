"use client"

import * as React from "react"
import { Bell, TrendingUp } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { NotificationService, Notification } from "@/shared/lib/notification-service"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { useEffect, useState } from "react"
import { Badge } from '@/shared/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'
import { logger } from '@/shared/lib/logger'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [weeklyStats, setWeeklyStats] = useState<{ count: number; total: number } | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadNotifications()
      loadWeeklyStats()
      // Poll for new notifications every minute
      const interval = setInterval(() => {
        loadNotifications()
        loadWeeklyStats()
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  const loadWeeklyStats = async () => {
    if (!user || user.role !== 'barber') return
    
    try {
      // Get the start of the current week (Sunday)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Fetch barber id first
      const { data: barberData } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!barberData) return

      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('barber_payout')
        .eq('barber_id', barberData.id)
        .gte('date', startOfWeek.toISOString())
        .neq('status', 'cancelled')

      if (error) throw error

      if (bookingsData) {
        const count = bookingsData.length
        const total = bookingsData.reduce((acc, curr) => acc + parseFloat(curr.barber_payout || '0'), 0)
        setWeeklyStats({ count, total })
      }
    } catch (error) {
      logger.error("Error loading weekly stats", error)
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    try {
      const userNotifications = await NotificationService.getUserNotifications(user.id)
      setNotifications(userNotifications)
      const count = await NotificationService.getUnreadCount(user.id)
      setUnreadCount(count)
    } catch (error) {
      logger.error("Error loading notifications", error)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId)
      await loadNotifications()
    } catch (error) {
      logger.error("Error marking notification as read", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return
    try {
      await NotificationService.markAllAsRead(user.id)
      await loadNotifications()
    } catch (error) {
      logger.error("Error marking all notifications as read", error)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative p-2 h-10 w-10 rounded-full bg-muted hover:bg-muted/80 border border-border transition-all duration-300 hover:border-saffron/30 hover:shadow-lg hover:shadow-saffron/20 group"
        >
          <Bell className="h-5 w-5 text-foreground group-hover:text-saffron transition-colors duration-300" />
          {unreadCount > 0 && (
            <>
              {/* Red blinker dot */}
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
              {/* Count badge */}
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-red-500/50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover backdrop-blur-xl border border-border shadow-2xl rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold text-foreground">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllAsRead}
              className="text-saffron hover:text-saffron/80 hover:bg-saffron/10 transition-all duration-300 text-sm font-medium"
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        {user?.role === 'barber' && weeklyStats && (
          <div className="p-4 mx-2 mt-2 bg-gradient-to-br from-saffron/20 to-orange-500/10 border border-saffron/30 rounded-xl shadow-lg shadow-saffron/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-saffron/20 flex items-center justify-center border border-saffron/30">
                <TrendingUp className="h-5 w-5 text-saffron" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-saffron uppercase tracking-wider mb-0.5">Weekly Performance</p>
                <div className="text-sm text-foreground leading-tight">
                  You have <span className="font-bold text-saffron">{weeklyStats.count}</span> {weeklyStats.count === 1 ? 'booking' : 'bookings'} this week and you are making <span className="font-bold text-saffron">${weeklyStats.total.toFixed(2)}</span> this week in Talii tips!
                </div>
              </div>
            </div>
          </div>
        )}
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "p-4 cursor-pointer rounded-xl mx-2 my-1 transition-all duration-300",
                    !notification.read 
                      ? "bg-saffron/10 border border-saffron/20 shadow-lg shadow-saffron/10" 
                      : "bg-white/5 hover:bg-white/10"
                  )}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex flex-col gap-2">
                    <div className={cn(
                      "font-medium text-sm",
                      !notification.read ? "text-saffron" : "text-foreground"
                    )}>
                      {notification.title}
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {notification.message}
                    </div>
                    <div className="text-xs text-muted-foreground/50 flex items-center justify-between">
                      <span>{new Date(notification.created_at).toLocaleString()}</span>
                      {!notification.read && (
                        <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 