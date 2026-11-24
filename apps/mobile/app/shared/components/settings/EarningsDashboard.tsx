import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { formatCents, type ConnectStatusResponse, type EarningsResponse } from '@barber-app/shared';
import { api, errorMessage } from '../../lib/api';
import { fetchConnectStatus, isStripeReady, openStripeConnect } from '../../lib/stripeConnect';
import { logger } from '../../lib/logger';
import { Card, CardContent } from '../ui';
import { 
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react-native';

interface EarningsData {
  /** Service + add-ons of completed appointments plus the net booking-fee share, in cents. */
  periodEarningsCents: number;
  periodFeeShareCents: number;
  periodServiceRevenueCents: number;
  weeklyEarningsCents: number;
  yearEarningsCents: number;
  completedBookings: number;
  averageServiceCents: number;
}

interface EarningsDashboardProps {
  barberId: string;
}

type Period = 'week' | 'month' | 'year';

/** Start of the current week, month or year on the device's calendar. */
function periodStart(period: Period, now: Date): Date {
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

const earned = (totals: EarningsResponse['totals']) => totals.serviceRevenueCents + totals.netFeeShareCents;

export function EarningsDashboard({ barberId }: EarningsDashboardProps) {
  const { colors } = useTheme();
  const [earnings, setEarnings] = useState<EarningsData>({
    periodEarningsCents: 0,
    periodFeeShareCents: 0,
    periodServiceRevenueCents: 0,
    weeklyEarningsCents: 0,
    yearEarningsCents: 0,
    completedBookings: 0,
    averageServiceCents: 0,
  });
  const [connect, setConnect] = useState<ConnectStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    if (barberId) {
      loadEarningsData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [barberId, period]);

  /** GET /api/earnings for the period, this week and the last 12 months; Stripe status. */
  const loadEarningsData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const now = new Date();
      const to = now.toISOString();
      const [current, week, year, status] = await Promise.all([
        api.earnings.get({ from: periodStart(period, now).toISOString(), to, limit: 1 }),
        api.earnings.get({ from: periodStart('week', now).toISOString(), to, limit: 1 }),
        api.earnings.get({ from: new Date(now.getTime() - 365 * 86_400_000).toISOString(), to, limit: 1 }),
        fetchConnectStatus(),
      ]);

      const completed = current.totals.completedBookings;
      setEarnings({
        periodEarningsCents: earned(current.totals),
        periodFeeShareCents: current.totals.netFeeShareCents,
        periodServiceRevenueCents: current.totals.serviceRevenueCents,
        weeklyEarningsCents: earned(week.totals),
        yearEarningsCents: earned(year.totals),
        completedBookings: completed,
        averageServiceCents: completed > 0 ? Math.round(current.totals.serviceRevenueCents / completed) : 0,
      });
      setConnect(status);
    } catch (error) {
      logger.error('Error loading earnings:', error);
      setLoadError(errorMessage(error, 'Failed to load earnings data'));
    } finally {
      setIsLoading(false);
    }
  };

  const stripeConnected = isStripeReady(connect);

  /** Onboarding or dashboard in the browser; the status is re-read when it closes. */
  const runConnect = async (kind: 'onboarding' | 'dashboard') => {
    if (connectBusy) return;
    setConnectBusy(true);
    try {
      const result = await openStripeConnect(kind);
      setConnect(result.status);
      if (result.needsNewLink) {
        Alert.alert('Continue Stripe Setup', 'The setup link expired. Tap Connect Stripe to continue where you left off.');
      } else if (result.linkType === 'onboarding') {
        showStatus(result.status);
      }
    } catch (error) {
      logger.error('Error opening Stripe:', error);
      Alert.alert('Error', errorMessage(error, 'Failed to open Stripe. Please try again.'));
    } finally {
      setConnectBusy(false);
    }
  };

  const handleStripeConnect = () => runConnect('onboarding');
  const handleViewStripeDetails = () => runConnect('dashboard');

  const showStatus = (status: ConnectStatusResponse | null) => {
    if (!status) {
      Alert.alert('Error', 'Could not check Stripe status. Please try again.');
    } else if (isStripeReady(status)) {
      Alert.alert('Success!', 'Your Stripe account is connected and ready to receive payments.');
    } else if (!status.hasAccount) {
      Alert.alert('Not Connected', 'You have not connected your Stripe account yet. Use "Connect Stripe" to set it up.');
    } else {
      Alert.alert(
        'Setup In Progress',
        'Your Stripe account is connected but setup is not finished yet. Please complete the remaining steps in Stripe.'
      );
    }
  };

  const checkStripeStatus = async () => {
    const status = await fetchConnectStatus();
    setConnect(status);
    showStatus(status);
  };

  if (loadError && !isLoading) {
    return (
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6 items-center`}>
          <Text style={[tw`text-base text-center mb-4`, { color: colors.foreground }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={loadEarningsData}
            style={[tw`py-2 px-4 rounded-xl flex-row items-center`, { backgroundColor: colors.glassBorder }]}
          >
            <RefreshCw size={16} color={colors.foreground} style={tw`mr-2`} />
            <Text style={{ color: colors.foreground }}>Try again</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6 items-center`}>
          <ActivityIndicator size="large" color={colors.primary} style={tw`mb-3`} />
          <Text style={[tw`text-base`, { color: colors.mutedForeground }]}>
            Loading earnings data...
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      {/* Stripe Connect Status */}
      {!stripeConnected && (
        <Card style={[tw`mb-6`, { backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-start`}>
              <AlertCircle size={20} color={colors.warning} style={tw`mr-3 mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={[tw`font-semibold mb-1`, { color: colors.warning }]}>
                  Connect Stripe to receive payments
                </Text>
                <Text style={[tw`text-sm mb-3`, { color: colors.warning }]}>
                  You need to connect your Stripe account to receive payouts from bookings.
                </Text>
                <TouchableOpacity
                  onPress={handleStripeConnect}
                  disabled={connectBusy}
                  style={[tw`py-2 px-4 rounded-xl flex-row items-center self-start`, { backgroundColor: colors.warning }]}
                >
                  <CreditCard size={16} color={colors.primary} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: colors.primary }]}>Connect Stripe</Text>
                  <ExternalLink size={14} color={colors.primary} style={tw`ml-2`} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={checkStripeStatus}
                  style={[tw`py-2 px-4 rounded-xl flex-row items-center self-start mt-2`, { backgroundColor: colors.glassBorder }]}
                >
                  <RefreshCw size={16} color={colors.foreground} style={tw`mr-2`} />
                  <Text>Check Status</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Period Selector */}
      <View style={tw`flex-row gap-2 mb-6`}>
        {(['week', 'month', 'year'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              tw`flex-1 py-2 rounded-xl`,
              period === p
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }
            ]}
          >
            <Text style={[
              tw`text-center font-medium capitalize`,
              { color: period === p ? colors.primaryForeground : colors.foreground }
            ]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Earnings Card */}
      <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
              {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Yearly'} Earnings
            </Text>
          </View>
          
          <Text style={[tw`text-3xl font-bold mb-4`, { color: colors.foreground }]}>
            {formatCents(earnings.periodEarningsCents)}
          </Text>
          <Text style={[tw`text-xs mb-2`, { color: colors.mutedForeground }]}>
            Service and add-ons of completed appointments ({formatCents(earnings.periodServiceRevenueCents)}, paid at the
            appointment) plus your booking-fee share ({formatCents(earnings.periodFeeShareCents)}, paid out by Stripe)
          </Text>

          <View style={tw`flex-row justify-between`}>
            <View>
              <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                Completed Bookings
              </Text>
              <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
                {earnings.completedBookings}
              </Text>
            </View>
            <View>
              <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                Avg. Service Price
              </Text>
              <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
                {formatCents(earnings.averageServiceCents)}
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <View style={tw`gap-3`}>
        <View style={tw`flex-row gap-3`}>
          <Card style={[tw`flex-1`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[tw`p-2 rounded-xl`, { backgroundColor: colors.primarySubtle }]}>
                  <DollarSign size={20} color={colors.primary} />
                </View>
                <TrendingUp size={16} color={colors.primary} />
              </View>
              <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                Last 12 Months
              </Text>
              <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
                {formatCents(earnings.yearEarningsCents)}
              </Text>
            </CardContent>
          </Card>

          <Card style={[tw`flex-1`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[tw`p-2 rounded-xl`, { backgroundColor: colors.primarySubtle }]}>
                  <Calendar size={20} color={colors.warning} />
                </View>
              </View>
              <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                This Week
              </Text>
              <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
                {formatCents(earnings.weeklyEarningsCents)}
              </Text>
            </CardContent>
          </Card>
        </View>

        {/* Pending Payouts */}
        {stripeConnected && (
          <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View>
                  <View style={tw`flex-row items-center mb-1`}>
                    <CreditCard size={16} color={colors.primary} style={tw`mr-2`} />
                    <Text style={[tw`font-medium`, { color: colors.foreground }]}>
                      Payouts
                    </Text>
                  </View>
                  <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                    Balance and payouts are in your Stripe dashboard
                  </Text>
                </View>
                <TouchableOpacity
                  style={[tw`px-4 py-2 rounded-xl`, { backgroundColor: colors.primarySubtle }]}
                  onPress={handleViewStripeDetails}
                  disabled={connectBusy}
                >
                  <Text style={[tw`text-sm font-medium`, { color: colors.primary }]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              </View>
            </CardContent>
          </Card>
        )}
      </View>

      {/* Success Message */}
      {stripeConnected && (
        <View style={[tw`mt-6 p-4 rounded-xl flex-row items-start`, { backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.primarySubtle }]}>
          <CheckCircle size={16} color={colors.primary} style={tw`mr-2 mt-0.5`} />
          <View style={tw`flex-1`}>
            <Text style={[tw`font-semibold mb-1`, { color: colors.primary }]}>
              Stripe Connected
            </Text>
            <Text style={[tw`text-sm`, { color: colors.primary }]}>
              Your payments are being processed automatically. Payouts occur daily.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
} 