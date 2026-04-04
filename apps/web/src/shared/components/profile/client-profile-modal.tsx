"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/router"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar"
import { Button } from "@/shared/components/ui/button"
import { Calendar, Clock, MapPin, Scissors, X } from "lucide-react"

type Client = {
  id: string
  name: string
  email: string
  phone?: string
  location?: string
  bio?: string
  joinDate: string
}

type Barber = {
  id: string
  name: string
  location?: string
  phone?: string
  bio?: string
  specialties: string[]
}

type Booking = {
  id: string
  barberId: string
  clientId: string
  serviceId: string
  date: Date
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price: number
  createdAt: Date
  updatedAt: Date
  barber: Barber
  service: {
    name: string
    duration: number
    price: number
  }
}

interface ClientProfileModalProps {
  client: Client | null
  bookings: Booking[]
  onClose: () => void
}

export function ClientProfileModal({
  client,
  bookings,
  onClose,
}: ClientProfileModalProps) {
  if (!client) return null

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full bg-background/80 border border-white/10 backdrop-blur-[40px] rounded-[2.5rem] shadow-2xl p-0 overflow-hidden outline-none">
        <div className="p-8 sm:p-12">
          <DialogHeader className="mb-10 p-0 text-left">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-secondary/10 rounded-2xl flex-shrink-0">
                <Scissors className="w-8 h-8 text-secondary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-4xl sm:text-5xl font-bebas font-bold text-foreground tracking-tight mb-2 leading-none">
                  Client <span className="text-secondary">Profile</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-base font-medium">
                  Detailed history and account information for {client.name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-10">
            {/* Client Info Card */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 p-8 bg-white/5 rounded-[2rem] border border-white/5">
              <div className="relative group">
                <div className="absolute inset-0 bg-secondary/20 rounded-full blur-2xl scale-90 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                <Avatar className="h-24 w-24 border-4 border-background ring-4 ring-white/5 relative z-10 transition-transform group-hover:scale-105">
                  <AvatarFallback className="bg-secondary text-primary-foreground font-bebas text-4xl">
                    {client.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h3 className="text-4xl font-bebas text-foreground tracking-wide mb-2">
                  {client.name}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground/80 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-secondary/60" />
                    {client.location || "Location not set"}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground/80 text-sm font-medium">
                    <Clock className="h-4 w-4 text-secondary/60" />
                    Member since {client.joinDate || "Recently"}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio Section */}
            {client.bio && (
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-1">Personal Bio</h4>
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-foreground/80 text-sm leading-relaxed italic">
                    "{client.bio}"
                  </p>
                </div>
              </div>
            )}

            {/* Booking History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Booking History</h4>
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded">
                  {bookings.length} Events
                </span>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {bookings.length === 0 ? (
                  <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                    <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground/40 text-sm font-medium">No previous bookings found</p>
                  </div>
                ) : (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="group flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-2xl hover:border-secondary/30 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-white/10 group-hover:border-secondary/30 transition-colors">
                          <AvatarFallback className="bg-background text-foreground/40 font-bebas text-lg">
                            {booking.barber.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-secondary transition-colors">
                            {booking.barber.name}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            {booking.service.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bebas tracking-wide text-foreground leading-none mb-1">
                          {new Date(booking.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            booking.status === 'completed' ? 'bg-green-500' :
                            booking.status === 'confirmed' ? 'bg-secondary' :
                            booking.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/40">
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-12">
            <Button
              className="w-full bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground h-16 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
              onClick={onClose}
            >
              Close Profile
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
