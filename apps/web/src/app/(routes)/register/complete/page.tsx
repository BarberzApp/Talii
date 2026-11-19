"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { api, errorMessage } from "@/shared/lib/api"
import { useAuthStore } from "@/shared/stores/auth-store"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { toast } from "@/shared/components/ui/use-toast"
import { Scissors } from "lucide-react"
import Link from "next/link"
import { logger } from '@/shared/lib/logger'

export default function RegisterCompletePage() {
  const router = useRouter()
  const { user } = useAuth()
  const fetchUserProfile = useAuthStore((s) => s.fetchUserProfile)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    role: "",
    username: ""
  })

  // The database gives every account a role and username at sign-up; this page
  // lets the user pick a different username and, for a client, switch to barber.
  useEffect(() => {
    if (!user) return
    setProfile({ role: user.role, username: user.username })
    if (user.username) setForm((prev) => (prev.username ? prev : { ...prev, username: user.username || '' }))
    if (user.role) setForm((prev) => (prev.role ? prev : { ...prev, role: user.role || '' }))
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleRoleSelect = (role: "barber" | "client") => {
    setForm((prev) => ({ ...prev, role }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast({ title: "Error", description: "User not found. Please log in again.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      if (form.username && form.username !== user.username) {
        await api.me.update({ username: form.username })
      }
      if (form.role === 'barber' && user.role !== 'barber') {
        await api.me.becomeBarber({})
      }
      await fetchUserProfile(user.id)
    } catch (error) {
      logger.error('Failed to complete registration', error)
      setLoading(false)
      toast({ title: "Error", description: errorMessage(error, "Failed to update profile. Please try again."), variant: "destructive" })
      return
    }
    setLoading(false)
    router.replace(form.role === 'barber' ? '/barber/onboarding' : '/browse')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-6 bg-transparent">
        <div className="max-w-7xl mx-auto flex items-center">
          <Link href="/" className="text-2xl font-bebas font-bold text-saffron">BOCM</Link>
        </div>
      </header>
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center mb-6">
              <Scissors className="h-10 w-10 text-saffron mb-2 drop-shadow-lg" />
              <h2 className="text-3xl font-bebas font-bold text-white mb-1">Complete Your Registration</h2>
              <p className="text-white/70 text-center mb-2">Choose your role and username to finish setting up your account.</p>
            </div>
            {/* Debug section: show current profile data */}
            {profile && (
              <div className="mb-4 p-2 rounded-lg bg-black/20 border border-white/10 text-white/80 text-xs">
                <div className="font-semibold mb-1">Debug: Current Profile Data</div>
                <div><span className="font-semibold">Role:</span> {profile.role ? <span>{profile.role}</span> : <span className="text-red-400">(not set)</span>}</div>
                <div><span className="font-semibold">Username:</span> {profile.username ? <span>{profile.username}</span> : <span className="text-red-400">(not set)</span>}</div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex w-full max-w-xs mx-auto mb-2 bg-white/10 border border-white/20 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('client')}
                  disabled={user?.role === 'barber'}
                  className={`w-1/2 py-2 rounded-full text-base font-semibold transition-all duration-150
                    ${form.role === 'client' ? 'bg-saffron text-primary shadow-md' : 'bg-transparent text-white hover:bg-white/5'}`}
                  aria-pressed={form.role === 'client'}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('barber')}
                  className={`w-1/2 py-2 rounded-full text-base font-semibold transition-all duration-150
                    ${form.role === 'barber' ? 'bg-saffron text-primary shadow-md' : 'bg-transparent text-white hover:bg-white/5'}`}
                  aria-pressed={form.role === 'barber'}
                >
                  Barber
                </button>
              </div>
              <div>
                <label htmlFor="username" className="block text-white mb-1 font-semibold">Username</label>
                <Input
                  id="username"
                  name="username"
                  placeholder="yourusername"
                  value={form.username}
                  onChange={handleChange}
                  className="h-11 bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron rounded-xl"
                  required
                />
              </div>
              <Button type="submit" className="w-full mt-2 bg-saffron text-primary font-semibold rounded-xl px-8 py-3 hover:bg-saffron/90 shadow-lg text-lg transition-all duration-200 hover:scale-105 active:scale-100 focus:ring-2 focus:ring-saffron focus:ring-offset-2 focus:ring-offset-darkpurple" disabled={loading || !form.role || !form.username}>
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 