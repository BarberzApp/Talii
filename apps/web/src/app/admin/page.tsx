"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AdminRouteGuard } from "@/shared/components/admin/AdminRouteGuard";
import { ReviewModeration } from "@/shared/components/admin/ReviewModeration";
import { UserProfileManager } from "@/shared/components/admin/UserProfileManager";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { useToast } from "@/shared/components/ui/use-toast";
import { logger } from "@/shared/lib/logger";
import { api, errorMessage } from "@/shared/lib/api";
import {
  MessageSquare, Users, Calendar, DollarSign, AlertTriangle,
  UserCheck, Activity, Crown, Search, Loader2, Zap,
} from "lucide-react";
import { useAdminAuth } from "@/shared/hooks/useAdminAuth";

interface AdminUserRow {
  id: string
  user_id: string
  business_name: string
  fee_exempt: boolean
  created_at: string
  name: string
  email: string
  role: string
  is_disabled: boolean
  avatar_url?: string
  /** Listed unless suspended by an admin. */
  is_public: boolean
}

const ADMIN_PAGE_SIZE = 25;

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBarbers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingReviews: 0,
    activeBookings: 0,
    newUsersToday: 0,
    revenueToday: 0,
    feeExemptBarbers: 0,
  });
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "exempt" | "regular">("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const { adminUser } = useAdminAuth();
  const { toast } = useToast();
  const usersCountRef = useRef(0);
  usersCountRef.current = users.length;

  /** GET /api/admin/stats?days=1 ("today" = the last 24 hours); money shown in dollars. */
  const fetchStats = useCallback(async () => {
    try {
      const { stats: s } = await api.admin.stats(1);
      setStats({
        totalUsers: s.users_total,
        totalBarbers: s.barbers_total,
        totalBookings: s.bookings_total,
        totalRevenue: s.fees_charged_cents / 100,
        pendingReviews: s.reports_pending,
        activeBookings: s.bookings_upcoming,
        newUsersToday: s.users_new_since,
        revenueToday: s.fees_charged_since_cents / 100,
        feeExemptBarbers: s.barbers_fee_exempt,
      });
    } catch (error) {
      logger.error('Error fetching stats', error);
    }
  }, []);

  /** GET /api/admin/users?role=barber&q=, searched on the server and paged. */
  const fetchUsers = useCallback(async (reset = true) => {
    try {
      if (!reset) setLoadingMore(true);
      const { users: list, pagination } = await api.admin.listUsers({
        role: 'barber',
        q: searchTerm.trim() || undefined,
        limit: ADMIN_PAGE_SIZE,
        offset: reset ? 0 : usersCountRef.current,
      });
      setUserTotal(pagination.total);
      const page = list.map((u): AdminUserRow => ({
        id: u.barber?.id ?? u.id,
        user_id: u.id,
        business_name: u.barber?.business_name ?? '',
        fee_exempt: !!u.billing?.fee_exempt,
        created_at: u.created_at,
        name: u.name ?? u.username,
        email: u.email ?? '',
        role: u.role,
        is_disabled: u.is_disabled,
        avatar_url: u.avatar_url ?? undefined,
        is_public: !u.barber?.listing_suspended,
      }));
      setUsers(prev => (reset ? page : [...prev, ...page]));
    } catch (error) {
      logger.error('Error fetching users', error);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to fetch users'), variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  }, [searchTerm, toast]);

  const adminId = adminUser?.id;

  useEffect(() => {
    if (adminId) fetchStats();
  }, [adminId, fetchStats]);

  // Search runs on the server, debounced.
  useEffect(() => {
    if (!adminId) return;
    const timer = setTimeout(() => fetchUsers(true), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, adminId, fetchUsers]);

  const patchRow = (userId: string, patch: Partial<AdminUserRow>) =>
    setUsers(prev => prev.map(u => (u.user_id === userId ? { ...u, ...patch } : u)));

  const toggleFeeExempt = async (row: AdminUserRow) => {
    setUpdating(row.user_id);
    try {
      await api.admin.updateUser(row.user_id, { feeExempt: !row.fee_exempt });
      patchRow(row.user_id, { fee_exempt: !row.fee_exempt });
      fetchStats();
      toast({
        title: 'Fee exemption updated',
        description: `Booking fee ${!row.fee_exempt ? 'waived' : 'charged'} for this barber`,
      });
    } catch (error) {
      logger.error('Error updating fee exemption', error);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update fee exemption'), variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const toggleAccountStatus = async (row: AdminUserRow) => {
    setUpdating(row.user_id);
    try {
      const result = await api.admin.updateUser(row.user_id, { isDisabled: !row.is_disabled });
      patchRow(row.user_id, { is_disabled: result.user.is_disabled });
      toast({
        title: 'Account status updated',
        description: result.signInBlocked === false
          ? 'Account disabled, but blocking sign-in failed. Try again.'
          : `Account ${result.user.is_disabled ? 'disabled' : 'enabled'}`,
      });
    } catch (error) {
      logger.error('Error updating account status', error);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update account status'), variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  /** Listing visibility (admin suspension); the barber's own is_public is separate. */
  const toggleListing = async (row: AdminUserRow) => {
    setUpdating(row.user_id);
    try {
      await api.admin.updateUser(row.user_id, { listingSuspended: row.is_public });
      patchRow(row.user_id, { is_public: !row.is_public });
      toast({ title: 'Visibility updated', description: `Listing ${row.is_public ? 'suspended' : 'restored'}` });
    } catch (error) {
      logger.error('Error updating listing status', error);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update visibility'), variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const updateRole = async (row: AdminUserRow, newRole: string) => {
    if (newRole !== 'client' && newRole !== 'barber') return;
    setUpdating(row.user_id);
    try {
      await api.admin.updateUser(row.user_id, { role: newRole });
      patchRow(row.user_id, { role: newRole });
      toast({ title: 'Role updated', description: `User role changed to ${newRole}` });
    } catch (error) {
      logger.error('Error updating role', error);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to update role'), variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Text search is done by the server; this only applies the fee-exemption filter.
  const filteredUsers = users.filter(u => {
    if (userFilter === 'exempt') return u.fee_exempt;
    if (userFilter === 'regular') return !u.fee_exempt;
    return true;
  });

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: { title: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string }) => (
    <Card className="bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-white/60 text-sm font-medium">{title}</p>
            <p className="text-white font-bold text-2xl mt-2">{value}</p>
            {subtitle && <p className="text-white/40 text-xs mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const filterButton = (value: typeof userFilter, label: string) => (
    <Button
      variant={userFilter === value ? 'default' : 'outline'}
      size="sm"
      onClick={() => setUserFilter(value)}
      className={userFilter === value ? '' : 'bg-white/10 border-white/20 text-white/80'}
    >
      {label}
    </Button>
  );

  const tabClass = "text-white data-[state=active]:bg-button data-[state=active]:text-button-foreground rounded-lg px-1 sm:px-3 py-2 text-xs sm:text-sm";

  return (
    <AdminRouteGuard hideHeader={true}>
      {/* The admin screens are designed dark (white text), so they get a dark backdrop. */}
      <div className="min-h-screen bg-neutral-950 px-4 py-6 sm:p-8 pb-36 md:pb-8 space-y-6 overflow-x-hidden">
        <div className="bg-gradient-to-r from-black/95 to-black/80 border-b border-white/20 backdrop-blur-xl rounded-xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-secondary to-secondary/80 rounded-xl">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin</h1>
                <p className="text-white/60 mt-1">Platform numbers, users and reviews.</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-right">
                <p className="text-white/60 text-sm">Logged in as</p>
                <p className="text-white font-medium">{adminUser?.email}</p>
              </div>
              <Avatar className="w-10 h-10">
                <AvatarImage src={adminUser?.avatar_url} />
                <AvatarFallback className="bg-secondary text-white">
                  {adminUser?.name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto bg-white/10 border border-white/20 p-1 rounded-xl">
            <TabsTrigger value="overview" className={tabClass}>Overview</TabsTrigger>
            <TabsTrigger value="users" className={tabClass}>Users</TabsTrigger>
            <TabsTrigger value="profiles" className={tabClass}>Profiles</TabsTrigger>
            <TabsTrigger value="reviews" className={tabClass}>Reviews</TabsTrigger>
          </TabsList>

          {/* Platform numbers (GET /api/admin/stats) */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <StatCard title="Users" value={stats.totalUsers.toLocaleString()} icon={Users} color="bg-blue-500/20" subtitle={`${stats.newUsersToday} new in the last 24 hours`} />
              <StatCard title="Barbers" value={stats.totalBarbers} icon={UserCheck} color="bg-green-500/20" subtitle={`${stats.feeExemptBarbers} fee exempt`} />
              <StatCard title="Booking fees" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="bg-purple-500/20" subtitle={`${formatCurrency(stats.revenueToday)} in the last 24 hours`} />
              <StatCard title="Upcoming bookings" value={stats.activeBookings} icon={Calendar} color="bg-indigo-500/20" subtitle="Pending or confirmed" />
              <StatCard title="Open reports" value={stats.pendingReviews} icon={AlertTriangle} color="bg-yellow-500/20" subtitle="Waiting for a decision" />
              <StatCard title="Bookings" value={stats.totalBookings} icon={Activity} color="bg-emerald-500/20" subtitle="All time" />
            </div>
          </TabsContent>

          {/* Barbers: search, fee exemption, account status, listing */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  type="text"
                  placeholder="Search barbers..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {filterButton('all', `All (${users.length})`)}
                {filterButton('exempt', `Fee exempt (${users.filter(u => u.fee_exempt).length})`)}
                {filterButton('regular', `Regular (${users.filter(u => !u.fee_exempt).length})`)}
              </div>
            </div>
            <p className="text-sm text-white/60">
              Fee-exempt barbers pay no booking fee, so clients pay them the service price in person.
            </p>

            {filteredUsers.length === 0 ? (
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No users found</h3>
                  <p className="text-white/60">{searchTerm ? 'Try adjusting your search terms' : 'Nothing to show yet'}</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((row) => (
                <Card key={row.user_id} className={row.is_disabled ? 'bg-red-500/10 border-red-400/50' : 'bg-white/10 border-white/20'}>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarImage src={row.avatar_url} />
                        <AvatarFallback className="bg-secondary text-white">{row.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{row.name || 'Unknown'}</h3>
                        <p className="text-white/80 text-sm truncate">{row.email}</p>
                        <p className="text-white/60 text-xs">Joined: {new Date(row.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-500 text-white text-xs">{row.role.toUpperCase()}</Badge>
                      {row.fee_exempt && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <Zap className="h-3 w-3 inline mr-1" />FEE EXEMPT
                        </Badge>
                      )}
                      {row.is_disabled && <Badge className="bg-red-500 text-white text-xs">DISABLED</Badge>}
                      <Badge className={`${row.is_public ? 'bg-green-500' : 'bg-gray-500'} text-white text-xs`}>
                        {row.is_public ? 'LISTED' : 'SUSPENDED'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                      <div>
                        <p className="text-sm font-semibold text-white mb-1">Role</p>
                        <Select
                          value={row.role || 'client'}
                          onValueChange={(value: string) => updateRole(row, value)}
                          disabled={updating === row.user_id}
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
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Active</p>
                        <Switch checked={!row.is_disabled} onCheckedChange={() => toggleAccountStatus(row)} disabled={updating === row.user_id} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Listed</p>
                        <Switch checked={row.is_public} onCheckedChange={() => toggleListing(row)} disabled={updating === row.user_id} />
                      </div>
                      {row.role === 'barber' && (
                        <div>
                          <p className="text-sm font-semibold text-white mb-2">Fee exempt</p>
                          <Switch checked={row.fee_exempt} onCheckedChange={() => toggleFeeExempt(row)} disabled={updating === row.user_id || row.is_disabled} />
                        </div>
                      )}
                      {updating === row.user_id && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            {users.length < userTotal && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => fetchUsers(false)}
                  disabled={loadingMore}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  {loadingMore ? 'Loading…' : `Load more (${users.length} of ${userTotal})`}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profiles">
            <UserProfileManager />
          </TabsContent>

          <TabsContent value="reviews">
            <div className="rounded-xl bg-neutral-950 p-0 sm:p-6">
              <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Review moderation
              </h2>
              <ReviewModeration />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRouteGuard>
  );
}
