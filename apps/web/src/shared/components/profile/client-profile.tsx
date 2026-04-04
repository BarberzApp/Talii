"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/router"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import { Calendar, MapPin, Scissors, Heart, Upload, Camera, Loader2 } from "lucide-react"
import { useToast } from "@/shared/components/ui/use-toast"
import Link from "next/link"
import type { User } from "@/features/auth/hooks/use-auth"
import { useData } from "@/shared/hooks/use-data"
import type { Booking, Barber, Service } from "@/shared/hooks/use-data"
import { supabase } from "@/shared/lib/supabase"
import { Textarea } from "@/shared/components/ui/textarea"
import { Progress } from "@/shared/components/ui/progress"
import { logger } from "@/shared/lib/logger"

interface ClientProfileProps {
  user: User
}

export function ClientProfile({ user }: ClientProfileProps) {
  const { toast } = useToast()
  const { bookings, loading, error } = useData()
  const userBookings = bookings.filter(b => b.clientId === user.id)
  const [avatarUrl, setAvatarUrl] = useState((user as any)?.avatar_url || "")
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return
      const file = e.target.files[0]
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file type', description: 'Please select an image file.', variant: 'destructive' })
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' })
        return
      }
      setAvatarLoading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id)
      if (updateError) throw updateError
      setAvatarUrl(publicUrl)
      toast({ title: 'Success', description: 'Avatar updated successfully!' })
    } catch (error) {
      logger.error('Error uploading avatar', error)
      toast({ title: 'Error', description: 'Failed to upload avatar. Please try again.', variant: 'destructive' })
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully",
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Indeterminate Progress Bar for Avatar Upload */}
      {avatarLoading && (
        <div className="fixed top-0 left-0 right-0 z-[100]">
          <Progress value={100} className="h-1 animate-pulse bg-secondary/20" />
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl lg:text-7xl font-bebas font-bold text-foreground mb-4 tracking-tight">
          Account <span className="text-secondary">Settings</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
          Personalize your Talii experience and manage your profile details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Settings Form */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[2rem] shadow-2xl overflow-hidden">
            <CardHeader className="p-8 pb-0">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-secondary/20 rounded-full blur-2xl scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Avatar className="h-32 w-32 border-4 border-background ring-4 ring-white/5 group-hover:ring-secondary/20 transition-all duration-500 relative z-10">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name || 'Avatar'} className="object-cover" />}
                    <AvatarFallback className="bg-secondary text-primary-foreground font-bebas text-4xl">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    className="absolute bottom-1 right-1 bg-secondary text-primary-foreground rounded-full p-3 shadow-xl focus:outline-none focus:ring-4 focus:ring-secondary/20 z-20 transition-all hover:scale-110 active:scale-95"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload profile picture"
                    disabled={avatarLoading}
                  >
                    {avatarLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={avatarLoading}
                  />
                </div>
                <div className="text-center sm:text-left">
                  <CardTitle className="text-3xl font-bebas tracking-wide text-foreground mb-1">{user.name}</CardTitle>
                  <p className="text-muted-foreground font-medium mb-3">{user.email}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <Badge variant="secondary" className="bg-secondary/10 text-secondary border-none px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                      Client
                    </Badge>
                    <Badge variant="outline" className="border-white/10 text-muted-foreground/60 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                      Joined {user.joinDate || 'Recently'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="location" className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-1">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <Input
                        id="location"
                        name="location"
                        placeholder="e.g. London, UK"
                        defaultValue={user.location || ''}
                        className="bg-white/5 border-white/10 text-foreground h-14 pl-12 rounded-2xl focus:border-secondary/50 focus:ring-secondary/20 transition-all placeholder:text-muted-foreground/30"
                      />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="phone" className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-1">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      defaultValue={user.phone || ''}
                      className="bg-white/5 border-white/10 text-foreground h-14 rounded-2xl focus:border-secondary/50 focus:ring-secondary/20 transition-all placeholder:text-muted-foreground/30"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="bio" className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-1">Personal Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    placeholder="Tell the community about yourself..."
                    defaultValue={user.bio || ''}
                    className="bg-white/5 border-white/10 text-foreground min-h-[150px] rounded-2xl focus:border-secondary/50 focus:ring-secondary/20 transition-all placeholder:text-muted-foreground/30 leading-relaxed py-4"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
                  <Button 
                    type="submit" 
                    disabled={avatarLoading}
                    className="flex-1 bg-secondary text-primary-foreground font-bold hover:bg-secondary/90 h-14 rounded-2xl shadow-lg shadow-secondary/10 transition-all active:scale-95"
                  >
                    Save Profile Changes
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground h-14 px-8 rounded-2xl transition-all"
                    onClick={() => window.location.href = '/profile'}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[2rem] shadow-2xl overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl font-bebas tracking-wide text-foreground">Lifestyle Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-4">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 group hover:border-secondary/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-0.5">Total Appointments</p>
                    <p className="text-3xl font-bebas text-foreground leading-none">{userBookings.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 group hover:border-secondary/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-0.5">Favorite Stylists</p>
                    <p className="text-3xl font-bebas text-foreground leading-none">
                      {[...new Set(userBookings.map(b => b.barber.id))].length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 group hover:border-secondary/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Scissors className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-0.5">Member Status</p>
                    <p className="text-3xl font-bebas text-secondary leading-none">Elite Client</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logout Section */}
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-center">
            <Button 
              variant="link" 
              className="text-red-500/60 hover:text-red-500 font-bold uppercase tracking-widest text-[10px]"
            >
              Request Account Deletion
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
