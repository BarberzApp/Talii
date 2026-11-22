"use client";

import { useState, useEffect } from "react";
import { AdminRouteGuard } from "@/shared/components/admin/AdminRouteGuard";
import { ReviewModeration } from "@/shared/components/admin/ReviewModeration";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { logger } from "@/shared/lib/logger";
import { api } from "@/shared/lib/api";
import {
  MessageSquare,
  Users, Calendar,
  DollarSign, AlertTriangle, UserCheck, Activity, Crown
} from "lucide-react";
import { useAdminAuth } from "@/shared/hooks/useAdminAuth";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBarbers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingReviews: 0,
    activeBookings: 0,
    newUsersToday: 0,
    revenueToday: 0
  });
  const [, setLoading] = useState(true);
  const { adminUser, isSuperAdmin } = useAdminAuth();

  useEffect(() => {
    if (adminUser) fetchStats();
  }, [adminUser?.id]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // GET /api/admin/stats (last 24 hours for "today"); money shown in dollars.
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
      });
    } catch (error) {
      logger.error('Error fetching stats', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: { title: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string }) => (
    <Card className="bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
      <CardContent className="p-6">
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


  return (
    <AdminRouteGuard hideHeader={true}>
      {/* The admin screens are designed dark (white text), so they get a dark backdrop. */}
      <div className="min-h-screen bg-neutral-950 px-4 py-6 sm:p-8 pb-36 md:pb-8 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-black/95 to-black/80 border-b border-white/20 backdrop-blur-xl rounded-xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-secondary to-secondary/80 rounded-xl">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-2">
                  Review moderation
                  {isSuperAdmin && (
                    <Badge variant="secondary" className="text-xs">
                      SUPER ADMIN
                    </Badge>
                  )}
                </h1>
                <p className="text-white/60 mt-1">
                  Platform numbers and reviews waiting for a decision.
                </p>
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

        {/* Platform numbers (GET /api/admin/stats) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatCard title="Users" value={stats.totalUsers.toLocaleString()} icon={Users} color="bg-blue-500/20" subtitle={`${stats.newUsersToday} new in the last 24 hours`} />
          <StatCard title="Barbers" value={stats.totalBarbers} icon={UserCheck} color="bg-green-500/20" subtitle="With a barber account" />
          <StatCard title="Booking fees" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="bg-purple-500/20" subtitle={`${formatCurrency(stats.revenueToday)} in the last 24 hours`} />
          <StatCard title="Upcoming bookings" value={stats.activeBookings} icon={Calendar} color="bg-indigo-500/20" subtitle="Pending or confirmed" />
          <StatCard title="Open reports" value={stats.pendingReviews} icon={AlertTriangle} color="bg-yellow-500/20" subtitle="Waiting for a decision" />
          <StatCard title="Bookings" value={stats.totalBookings} icon={Activity} color="bg-emerald-500/20" subtitle="All time" />
        </div>

        {/* Review moderation; users, reports and barbers live on the main admin page. */}
        <Card className="bg-white/5 border border-white/10">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Review moderation
            </CardTitle>
            <Button href="/super-admin" variant="outline" size="sm">Users and reports</Button>
          </CardHeader>
          <CardContent>
            <ReviewModeration />
          </CardContent>
        </Card>
      </div>
    </AdminRouteGuard>
  );
} 