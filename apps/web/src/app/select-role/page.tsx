"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/shared/lib/api";
import { useAuth } from "@/shared/hooks/use-auth-zustand";
import { useAuthStore } from "@/shared/stores/auth-store";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2 } from "lucide-react";
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

export default function SelectRolePage() {
  const { user, status } = useAuth();
  const fetchUserProfile = useAuthStore((s) => s.fetchUserProfile);
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { replace: safeReplace } = useSafeNavigation();

  // Every account gets a role at sign-up (the database defaults to client), so
  // this page only lets a client switch to barber. Barbers go straight on.
  useEffect(() => {
    if (status === "unauthenticated") {
      safeReplace("/login");
    } else if (user?.isAdmin) {
      safeReplace("/super-admin");
    } else if (user?.role === "barber") {
      safeReplace("/barber/onboarding");
    }
  }, [user, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setError("Please select a role.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (role === "barber") {
        await api.me.becomeBarber({});
        if (user) await fetchUserProfile(user.id);
        safeReplace("/barber/onboarding");
      } else {
        safeReplace("/browse");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to update role."));
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-saffron" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Select Your Role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="client"
                  checked={role === "client"}
                  onChange={() => setRole("client")}
                  disabled={loading}
                />
                Client
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="barber"
                  checked={role === "barber"}
                  onChange={() => setRole("barber")}
                  disabled={loading}
                />
                Barber
              </label>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 