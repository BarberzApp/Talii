'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/shared/lib/logger'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ReviewModeration } from '@/shared/components/admin/ReviewModeration'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import {
  Loader2,
  Shield,
  Users,
  Crown,
  LogOut,
  Search, Eye, Calendar, DollarSign,
  Activity, Zap, MessageSquare, User
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { api, errorMessage } from '@/shared/lib/api'
import { useAuthStore } from '@/shared/stores/auth-store'
import { UserProfileManager } from '@/shared/components/admin/UserProfileManager'

interface Barber {
  id: string
  user_id: string
  business_name: string
  fee_exempt: boolean
  created_at: string
  profiles: {
    id: string
    name: string
    email: string
    role: string
    phone?: string
    location?: string
    bio?: string
    is_disabled?: boolean
    created_at?: string
    avatar_url?: string
    is_public?: boolean
  }
  services?: Array<{
    id: string
    name: string
    price: number
    duration: number
  }>
  bookings?: Array<{
    id: string
    status: string
    created_at: string
  }>
}

interface UserStats {
  totalUsers: number
  totalBarbers: number
  totalClients: number
  disabledAccounts: number
  developers: number
  activeBookings: number
  totalRevenue: number
  pendingReviews: number
  newUsersToday: number
  revenueToday: number
  developerRevenue?: number
  regularRevenue?: number
  developerBookings?: number
  regularBookings?: number
}

const ADMIN_PAGE_SIZE = 25

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [barberTotal, setBarberTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [userFilter, setUserFilter] = useState<'all' | 'developers' | 'regular'>('all')
  const [updatingBarber, setUpdatingBarber] = useState<string | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalBarbers: 0,
    totalClients: 0,
    disabledAccounts: 0,
    developers: 0,
    activeBookings: 0,
    totalRevenue: 0,
    pendingReviews: 0,
    newUsersToday: 0,
    revenueToday: 0
  })
  const [activeTab, setActiveTab] = useState('dashboard')
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)

  const loadDashboard = () => {
    fetchStats()
  }

  // Admin = GET /api/me isAdmin (auth app_metadata.role, set with scripts/set-admin.ts).
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const me = await api.me.get()
        if (me.isAdmin) {
          setIsAuthenticated(true)
          loadDashboard()
        }
      } catch (error) {
        logger.error('Error checking admin', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSuperAdmin()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: adminEmail.trim(), password })

      if (error) {
        toast({
          title: 'Access Denied',
          description: error.message || 'Invalid credentials',
          variant: 'destructive',
        })
        return
      }

      const me = await api.me.get()
      if (me.isAdmin) {
        setIsAuthenticated(true)
        loadDashboard()
        toast({
          title: 'Admin Access Granted',
          description: 'Welcome to the Admin Panel',
        })
      } else {
        await supabase.auth.signOut()
        toast({
          title: 'Access Denied',
          description: 'Only admins can access this page',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: errorMessage(error, 'Network error. Please try again.'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * GET /api/admin/users?role=barber&q=, searched on the server (name, username,
   * email) and paged; shaped like the old barber rows this page renders.
   */
  const fetchBarbers = async (reset = true) => {
    try {
      if (!reset) setLoadingMore(true)
      const offset = reset ? 0 : barbers.length
      const { users, pagination } = await api.admin.listUsers({
        role: 'barber',
        q: searchTerm.trim() || undefined,
        limit: ADMIN_PAGE_SIZE,
        offset,
      })
      setBarberTotal(pagination.total)
      const page = users.map((u): Barber => ({
          id: u.barber?.id ?? u.id,
          user_id: u.id,
          business_name: u.barber?.business_name ?? '',
          fee_exempt: !!u.billing?.fee_exempt,
          created_at: u.created_at,
          profiles: {
            id: u.id,
            name: u.name ?? u.username,
            email: u.email ?? '',
            role: u.role,
            phone: u.phone ?? undefined,
            is_disabled: u.is_disabled,
            avatar_url: u.avatar_url ?? undefined,
            // Admin listing control: listed unless suspended by an admin.
            is_public: !u.barber?.listing_suspended,
          },
        }))
      setBarbers(prev => (reset ? page : [...prev, ...page]))
    } catch (error) {
      logger.error('Error fetching barbers', error)
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to fetch barbers'),
        variant: 'destructive',
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // Search runs on the server, debounced.
  useEffect(() => {
    if (!isAuthenticated) return
    const timer = setTimeout(() => fetchBarbers(true), 300)
    return () => clearTimeout(timer)
  }, [searchTerm, isAuthenticated])

  /** GET /api/admin/stats?days=1 ("today" = the last 24 hours). Money in dollars for display. */
  const fetchStats = async () => {
    try {
      const { stats: s } = await api.admin.stats(1)
      setStats({
        totalUsers: s.users_total,
        totalBarbers: s.barbers_total,
        totalClients: s.clients_total,
        disabledAccounts: s.disabled_total,
        developers: s.barbers_fee_exempt,
        activeBookings: s.bookings_upcoming,
        totalRevenue: s.fees_charged_cents / 100,
        pendingReviews: s.reports_pending,
        newUsersToday: s.users_new_since,
        revenueToday: s.fees_charged_since_cents / 100,
      })
    } catch (error) {
      logger.error('Error fetching stats', error)
    }
  }

  /** "Developer" is fee exemption now (barber_billing.fee_exempt). */
  const toggleDeveloperStatus = async (barberId: string, currentStatus: boolean) => {
    const target = barbers.find(b => b.id === barberId)
    if (!target) return
    setUpdatingBarber(barberId)
    try {
      await api.admin.updateUser(target.user_id, { feeExempt: !currentStatus })
      setBarbers(prev => prev.map(barber =>
        barber.id === barberId ? { ...barber, fee_exempt: !currentStatus } : barber
      ))
      fetchStats()
      toast({
        title: 'Fee Exemption Updated',
        description: `Booking fee ${!currentStatus ? 'waived' : 'charged'} for this barber`,
      })
    } catch (error) {
      logger.error('Error updating fee exemption', error)
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update fee exemption'), variant: 'destructive' })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const toggleAccountStatus = async (userId: string, currentStatus: boolean) => {
    setUpdatingBarber(userId)
    try {
      const result = await api.admin.updateUser(userId, { isDisabled: !currentStatus })
      setBarbers(prev => prev.map(barber =>
        barber.user_id === userId
          ? { ...barber, profiles: { ...barber.profiles, is_disabled: result.user.is_disabled } }
          : barber
      ))
      toast({
        title: 'Account Status Updated',
        description: result.signInBlocked === false
          ? 'Account disabled, but blocking sign-in failed. Try again.'
          : `Account ${result.user.is_disabled ? 'disabled' : 'enabled'}`,
      })
    } catch (error) {
      logger.error('Error updating account status', error)
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update account status'), variant: 'destructive' })
    } finally {
      setUpdatingBarber(null)
    }
  }

  /** Listing visibility (admin suspension); the barber's own is_public is separate. */
  const togglePublicStatus = async (userId: string, currentStatus: boolean) => {
    setUpdatingBarber(userId)
    try {
      const newStatus = !currentStatus
      await api.admin.updateUser(userId, { listingSuspended: !newStatus })
      setBarbers(prev => prev.map(barber =>
        barber.user_id === userId
          ? { ...barber, profiles: { ...barber.profiles, is_public: newStatus } }
          : barber
      ))
      toast({
        title: 'Profile Visibility Updated',
        description: `Listing ${newStatus ? 'restored' : 'suspended'}`,
      })
    } catch (error) {
      logger.error('Error updating listing status', error)
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update profile visibility. Please try again.'), variant: 'destructive' })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    if (newRole !== 'client' && newRole !== 'barber') return
    setUpdatingBarber(userId)
    try {
      await api.admin.updateUser(userId, { role: newRole })
      setBarbers(prev => prev.map(barber =>
        barber.user_id === userId
          ? { ...barber, profiles: { ...barber.profiles, role: newRole } }
          : barber
      ))
      toast({ title: 'Role Updated', description: `User role changed to ${newRole}` })
    } catch (error) {
      logger.error('Error updating role', error)
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update role'), variant: 'destructive' })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setBarbers([])
    toast({
      title: 'Logged Out',
      description: 'You have been logged out of Super Admin',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Text search is done by the server; this only applies the fee-exemption filter.
  const filteredBarbers = barbers.filter(barber => {
    if (userFilter === 'developers') return barber.fee_exempt
    if (userFilter === 'regular') return !barber.fee_exempt
    return true
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-secondary" />
          <p className="text-white/60 font-medium">Loading Super Admin Panel...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 border border-white/20 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Crown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bebas text-white tracking-wide">
                  Super Admin Access
                </CardTitle>
                <CardDescription className="text-white/80 mt-1">
                  Restricted access only
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={adminEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminEmail(e.target.value)}
                  placeholder="Admin email"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Enter super admin password"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Access Super Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-black/95 to-black/80 border-b border-white/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 min-h-16">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl">
                <Crown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bebas text-white tracking-wide">Super Admin Panel</h1>
                <p className="text-sm text-white/60">Complete Platform Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white/60 text-sm">Super Admin</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto bg-white/10 border border-white/20 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="text-white data-[state=active]:bg-white/20 rounded-lg px-1 sm:px-3 py-2 text-xs sm:text-sm flex-col sm:flex-row gap-1">
              <Activity className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-white data-[state=active]:bg-white/20 rounded-lg px-1 sm:px-3 py-2 text-xs sm:text-sm flex-col sm:flex-row gap-1">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Users &amp; Developers</span><span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="profiles" className="text-white data-[state=active]:bg-white/20 rounded-lg px-1 sm:px-3 py-2 text-xs sm:text-sm flex-col sm:flex-row gap-1">
              <User className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Profile Manager</span><span className="sm:hidden">Profiles</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="text-white data-[state=active]:bg-white/20 rounded-lg px-1 sm:px-3 py-2 text-xs sm:text-sm flex-col sm:flex-row gap-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-200">Total Users</p>
                      <p className="text-2xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
                      <p className="text-xs text-blue-300">+{stats.newUsersToday} today</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-300" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-200">Active Barbers</p>
                      <p className="text-2xl font-bold text-white">{stats.totalBarbers}</p>
                      <p className="text-xs text-green-300">{stats.developers} developers</p>
                    </div>
                    <Shield className="h-8 w-8 text-green-300" />
                  </div>
                </CardContent>
              </Card>
              
              {stats.developerRevenue !== undefined && (
                <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-400/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-200">Developer Revenue</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(stats.developerRevenue)}</p>
                        <p className="text-xs text-purple-300">{stats.developerBookings || 0} bookings (no fees)</p>
                      </div>
                      <Zap className="h-8 w-8 text-purple-300" />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-200">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
                      <p className="text-xs text-purple-300">+{formatCurrency(stats.revenueToday)} today</p>
                      {stats.regularRevenue !== undefined && (
                        <p className="text-xs text-purple-300/80 mt-1">
                          Regular: {formatCurrency(stats.regularRevenue)} ({stats.regularBookings || 0} bookings)
                        </p>
                      )}
                    </div>
                    <DollarSign className="h-8 w-8 text-purple-300" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-yellow-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-200">Pending Reviews</p>
                      <p className="text-2xl font-bold text-white">{stats.pendingReviews}</p>
                      <p className="text-xs text-yellow-300">Awaiting moderation</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-yellow-300" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => setActiveTab('users')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <Users className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Manage Users</p>
                  <p className="text-xs text-white/60">Account management</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => setActiveTab('users')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <Zap className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Manage Developers</p>
                  <p className="text-xs text-white/60">Users & developer mode</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => setActiveTab('reviews')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Review Moderation</p>
                  <p className="text-xs text-white/60">Content moderation</p>
                </div>
              </Button>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    User & Developer Management
                  </h2>
                  <p className="text-white/80 mt-1">Manage all user accounts, permissions, and developer mode</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={userFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('all')}
                    className={userFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/10 border-white/20 text-white/80'}
                  >
                    All ({barbers.length})
                  </Button>
                  <Button
                    variant={userFilter === 'developers' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('developers')}
                    className={userFilter === 'developers' ? 'bg-green-500/20 text-green-300 border-green-400/50' : 'bg-white/10 border-white/20 text-white/80'}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Developers ({barbers.filter(b => b.fee_exempt).length})
                  </Button>
                  <Button
                    variant={userFilter === 'regular' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('regular')}
                    className={userFilter === 'regular' ? 'bg-blue-500/20 text-blue-300 border-blue-400/50' : 'bg-white/10 border-white/20 text-white/80'}
                  >
                    Regular ({barbers.filter(b => !b.fee_exempt).length})
                  </Button>
                </div>
              </div>
            </div>

            {/* Developer Mode Info */}
            {userFilter === 'developers' || userFilter === 'all' ? (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Zap className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">Developer Mode</h4>
                    <p className="text-sm text-white/80">
                      Developer accounts bypass Stripe platform fees. Clients booking with developer barbers pay $0 in platform fees, 
                      and the barber receives 100% of the service revenue. This is useful for internal testing, partnerships, or special accounts.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {filteredBarbers.length === 0 ? (
                <Card className="bg-white/10 border-white/20">
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No users found</h3>
                    <p className="text-white/60">
                      {searchTerm ? 'Try adjusting your search terms' : `No ${userFilter === 'developers' ? 'developers' : userFilter === 'regular' ? 'regular barbers' : 'users'} found`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredBarbers.map((barber) => (
                <Card key={barber.id} className={`transition-all duration-300 ${
                  barber.profiles?.is_disabled 
                    ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/50' 
                    : 'bg-white/10 border-white/20'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={barber.profiles?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-white">
                            {barber.profiles?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">
                              {barber.profiles?.name || 'Unknown'}
                            </h3>
                            <Badge className={`font-bold px-2 py-1 text-xs ${
                              barber.profiles?.role === 'barber' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-500 text-white'
                            }`}>
                              {barber.profiles?.role?.toUpperCase() || 'UNKNOWN'}
                            </Badge>
                            {barber.fee_exempt && (
                              <Badge className="bg-green-500 text-white font-bold px-2 py-1 text-xs shadow-lg shadow-green-500/50">
                                <Zap className="h-3 w-3 inline mr-1" />
                                DEVELOPER
                              </Badge>
                            )}
                            {barber.profiles?.is_disabled && (
                              <Badge className="bg-red-500 text-white font-bold px-2 py-1 text-xs">
                                DISABLED
                              </Badge>
                            )}
                            {barber.profiles?.is_public !== undefined && (
                              barber.profiles.is_public ? (
                                <Badge className="bg-green-500 text-white font-bold px-2 py-1 text-xs">
                                  PUBLIC
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-500 text-white font-bold px-2 py-1 text-xs">
                                  PRIVATE
                                </Badge>
                              )
                            )}
                          </div>
                          <p className="text-white/80 text-sm">{barber.profiles?.email}</p>
                          <p className="text-white/60 text-xs">
                            Joined: {new Date(barber.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                                              <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Role</p>
                            <Select
                              value={barber.profiles?.role || 'client'}
                              onValueChange={(value: string) => updateUserRole(barber.user_id, value)}
                              disabled={updatingBarber === barber.user_id}
                            >
                              <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="barber">Barber</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Status</p>
                            <Switch
                              checked={!barber.profiles?.is_disabled}
                              onCheckedChange={() => toggleAccountStatus(barber.user_id, barber.profiles?.is_disabled || false)}
                              disabled={updatingBarber === barber.user_id}
                              className={`scale-125 transition-all duration-200 ${
                                !barber.profiles?.is_disabled
                                  ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                                  : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                              }`}
                            />
                          </div>

                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Visibility</p>
                            <Switch
                              checked={barber.profiles?.is_public ?? false}
                              onCheckedChange={() => togglePublicStatus(barber.user_id, barber.profiles?.is_public ?? false)}
                              disabled={updatingBarber === barber.user_id || !barber.profiles}
                              className={`scale-125 transition-all duration-200 ${
                                (barber.profiles?.is_public ?? false)
                                  ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                                  : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                              }`}
                            />
                          </div>

                          {barber.profiles?.role === 'barber' && (
                            <div className="text-center">
                              <p className="text-sm font-semibold text-white mb-2">Developer Mode</p>
                              <Switch
                                checked={barber.fee_exempt}
                                onCheckedChange={() => toggleDeveloperStatus(barber.id, barber.fee_exempt)}
                                disabled={updatingBarber === barber.id || barber.profiles?.is_disabled}
                                className={`scale-125 transition-all duration-200 ${
                                  barber.fee_exempt 
                                    ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                                    : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                                }`}
                              />
                              {updatingBarber === barber.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-white mt-1 mx-auto" />
                              )}
                            </div>
                          )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => setSelectedBarber(barber)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-darkpurple border-white/20 text-white max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl">User Details</DialogTitle>
                              <DialogDescription className="text-white/80">
                                Complete information for {barber.profiles?.name}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedBarber && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-white/60">Name</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Email</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.email}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Phone</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.phone || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Location</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.location || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Role</p>
                                    <p className="font-semibold capitalize">{selectedBarber.profiles?.role}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Status</p>
                                    <p className={`font-semibold ${selectedBarber.profiles?.is_disabled ? 'text-red-400' : 'text-green-400'}`}>
                                      {selectedBarber.profiles?.is_disabled ? 'Disabled' : 'Active'}
                                    </p>
                                  </div>
                                </div>
                                
                                {selectedBarber.profiles?.bio && (
                                  <div>
                                    <p className="text-sm text-white/60">Bio</p>
                                    <p className="text-sm">{selectedBarber.profiles.bio}</p>
                                  </div>
                                )}
                                
                                <div>
                                  <p className="text-sm text-white/60">Business Information</p>
                                  <p className="font-semibold">{selectedBarber.business_name || 'No business name'}</p>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    <span className="text-sm">Developer: {selectedBarber.fee_exempt ? 'Yes' : 'No'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">Joined: {new Date(selectedBarber.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
              {barbers.length < barberTotal && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => fetchBarbers(false)}
                    disabled={loadingMore}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {loadingMore ? 'Loading…' : `Load more (${barbers.length} of ${barberTotal})`}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Profile Manager Tab */}
          <TabsContent value="profiles" className="space-y-6">
            <UserProfileManager />
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <div className="rounded-xl bg-neutral-950 p-4 sm:p-6">
              <ReviewModeration />
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
} 