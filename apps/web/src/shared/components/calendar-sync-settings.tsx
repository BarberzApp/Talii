"use client"

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { useCalendarSync } from '@/shared/hooks/useCalendarSync';
import { Calendar, RefreshCw, Settings, Trash2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function CalendarSyncSettings() {
  const {
    connection,
    connected,
    loading,
    syncing,
    stats,
    recentLogs,
    connect,
    disconnect,
    sync,
    updateSettings
  } = useCalendarSync();

  const [localSyncEnabled, setLocalSyncEnabled] = useState(connection?.sync_enabled ?? false);
  const [localSyncDirection, setLocalSyncDirection] = useState(connection?.sync_direction ?? 'bidirectional');

  const handleSyncEnabledChange = async (enabled: boolean) => {
    setLocalSyncEnabled(enabled);
    await updateSettings({ sync_enabled: enabled });
  };

  const handleSyncDirectionChange = async (direction: 'inbound' | 'outbound' | 'bidirectional') => {
    setLocalSyncDirection(direction);
    await updateSettings({ sync_direction: direction });
  };

  const handleSync = async (direction?: 'inbound' | 'outbound' | 'bidirectional') => {
    const syncDirection = direction || localSyncDirection;
    await sync(syncDirection);
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect your Google Calendar? This will remove all sync data.')) {
      await disconnect();
    }
  };

  const formatLastSync = (lastSyncAt?: string) => {
    if (!lastSyncAt) return 'Never';
    return new Date(lastSyncAt).toLocaleString();
  };

  const getSyncStatusIcon = () => {
    if (syncing) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (connected) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  const getSyncStatusText = () => {
    if (syncing) return 'Syncing...';
    if (connected) return 'Connected';
    return 'Not connected';
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-white/10">
          <CardTitle className="flex items-center gap-3 text-2xl text-white">
            <div className="p-2 bg-secondary/20 rounded-xl">
              <Calendar className="h-6 w-6 text-secondary" />
            </div>
            Google Calendar Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="relative">
                <RefreshCw className="h-8 w-8 animate-spin text-secondary mx-auto" />
                <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
              </div>
              <p className="text-white/70 font-medium">Loading calendar sync...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-3xl rounded-[2.5rem] overflow-hidden ring-1 ring-white/5">
      <CardHeader className="bg-secondary/5 border-b border-foreground/5 p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-secondary/15 rounded-2xl border border-secondary/20 shadow-lg shadow-secondary/5">
              <Calendar className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-4xl text-foreground font-bebas tracking-wider flex items-center gap-4">
                Google Calendar Sync
              </CardTitle>
              <CardDescription className="text-foreground/50 text-lg font-medium italic mt-1">
                Automate your professional schedule across platforms
              </CardDescription>
            </div>
          </div>
        </div>
        
        {/* Alpha Warning */}
        <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-yellow-500/20 rounded-full">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">Alpha Version</p>
              <p className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                This feature may not work properly. Please notify the team if you encounter any issues.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {/* Enhanced Connection Status */}
        <div className="flex items-center justify-between p-6 bg-foreground/[0.03] rounded-[2rem] border border-foreground/5 group transition-all hover:bg-foreground/[0.05]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/15 rounded-xl border border-secondary/20 group-hover:scale-110 transition-transform">
              {getSyncStatusIcon()}
            </div>
            <div>
              <span className="font-bebas text-3xl text-foreground tracking-wide leading-none">{getSyncStatusText()}</span>
              {connected && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-secondary/10 text-secondary border-none">
                    {stats.syncedEventsCount} events synchronized
                  </Badge>
                </div>
              )}
            </div>
          </div>
          {connected && (
            <Button
              onClick={() => handleSync()}
              disabled={syncing}
              className="bg-secondary text-primary-foreground hover:bg-secondary/90 font-bold shadow-xl shadow-secondary/20 rounded-2xl px-8 h-14 transition-all active:scale-95"
            >
              <RefreshCw className={`h-5 w-5 mr-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
        </div>

        {/* Enhanced Connection Actions */}
        {!connected ? (
          <div className="space-y-6 p-10 bg-secondary/5 rounded-[2.5rem] border border-secondary/20 text-center">
            <div className="p-5 bg-secondary/15 rounded-3xl w-fit mx-auto shadow-2xl shadow-secondary/10 mb-4 animate-bounce">
              <ExternalLink className="h-10 w-10 text-secondary" />
            </div>
            <h3 className="text-5xl font-bebas text-foreground tracking-widest">Connect Your Calendar</h3>
            <p className="text-foreground/60 text-lg font-medium italic mb-8 max-w-md mx-auto">
              Sync your professional schedule and never miss a premium booking session.
            </p>
            <Button 
              onClick={connect} 
              className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90 font-bold shadow-2xl shadow-secondary/20 rounded-2xl py-8 text-xl transition-all active:scale-95"
            >
              <ExternalLink className="h-6 w-6 mr-3" />
              Connect Google Account
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enhanced Sync Settings */}
            <div className="space-y-8 p-8 bg-foreground/[0.03] rounded-[2.5rem] border border-foreground/5 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary/15 rounded-xl border border-secondary/20">
                  <Settings className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h4 className="text-3xl font-bebas text-foreground tracking-wider leading-none">Sync Intelligence</h4>
                  <p className="text-foreground/40 text-sm font-medium italic mt-1 uppercase tracking-widest">
                    Configure your autonomous schedule
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-foreground/[0.02] rounded-2xl border border-foreground/5 hover:bg-foreground/[0.04] transition-all">
                  <div>
                    <p className="font-bold text-foreground text-xl tracking-tight">Real-time Synchronization</p>
                    <p className="text-foreground/50 text-sm font-medium italic">Automatically manage all appointment changes</p>
                  </div>
                  <Switch
                    checked={localSyncEnabled}
                    onCheckedChange={handleSyncEnabledChange}
                    className="data-[state=checked]:bg-secondary"
                  />
                </div>

                <div className="space-y-4">
                  <p className="font-bold text-foreground/40 text-[10px] uppercase tracking-[0.2em] ml-2">Sync Direction</p>
                  <Select
                    value={localSyncDirection}
                    onValueChange={(value: 'inbound' | 'outbound' | 'bidirectional') => 
                      handleSyncDirectionChange(value)
                    }
                  >
                    <SelectTrigger className="bg-foreground/[0.04] border-foreground/5 text-foreground focus:ring-secondary/20 rounded-2xl h-14 text-lg font-semibold px-6 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 backdrop-blur-3xl border-foreground/10 rounded-2xl">
                      <SelectItem value="bidirectional" className="py-3 font-medium">Bidirectional (Recommended)</SelectItem>
                      <SelectItem value="outbound" className="py-3 font-medium">Outbound Only (App → Google)</SelectItem>
                      <SelectItem value="inbound" className="py-3 font-medium">Inbound Only (Google → App)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-[11px] text-foreground/30 font-bold uppercase tracking-widest bg-foreground/[0.02] p-4 rounded-xl border border-foreground/5 italic">
                    {localSyncDirection === 'bidirectional' && 'Full autonomous synchronization (Bidirectional)'}
                    {localSyncDirection === 'outbound' && 'Unidirectional Export: Talii → Google Calendar'}
                    {localSyncDirection === 'inbound' && 'Unidirectional Import: Google Calendar → Talii'}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Enhanced Sync Actions */}
            <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
              <h4 className="text-xl font-bebas text-white tracking-wide">Manual Sync</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={() => handleSync('bidirectional')}
                  disabled={syncing}
                  className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-semibold shadow-lg rounded-xl py-3"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Full Sync
                </Button>
                <Button
                  onClick={() => handleSync('outbound')}
                  disabled={syncing}
                  className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-semibold shadow-lg rounded-xl py-3"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  To Google
                </Button>
                <Button
                  onClick={() => handleSync('inbound')}
                  disabled={syncing}
                  className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-semibold shadow-lg rounded-xl py-3"
                >
                  <ExternalLink className="h-4 w-4 mr-2 rotate-180" />
                  From Google
                </Button>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Enhanced Connection Info */}
            <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
              <h4 className="text-xl font-bebas text-white tracking-wide">Connection Info</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/70">Provider:</span>
                  <span className="text-white font-medium">Google Calendar</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/70">Last Sync:</span>
                  <span className="text-white font-medium">{formatLastSync(connection?.last_sync_at)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/70">Connected:</span>
                  <span className="text-white font-medium">{connection?.created_at ? new Date(connection.created_at).toLocaleDateString() : 'Unknown'}</span>
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Enhanced Disconnect */}
            <div className="space-y-4 p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-2xl border border-red-500/20">
              <h4 className="text-xl font-bebas text-red-400 tracking-wide">Danger Zone</h4>
              <p className="text-white/70 text-sm">
                Disconnecting will remove all sync data and stop automatic syncing.
              </p>
              <Button
                onClick={handleDisconnect}
                disabled={syncing}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-lg rounded-xl py-3"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Disconnect Calendar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 