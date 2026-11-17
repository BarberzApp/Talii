'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

/**
 * Asks the API to re-read the Stripe account and store its status. Only works
 * when this browser has a web session (mobile users opening this page from the
 * app usually do not; the app refreshes the status itself after the deep link).
 */
async function refreshConnectStatus() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const response = await fetch('/api/stripe/connect/status', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      logger.warn('Stripe status refresh failed', { status: response.status });
    }
  } catch (error) {
    logger.error('Stripe status refresh error', error);
  }
}

export default function StripeConnectRefresh() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'retry' | 'error'>('loading');

  useEffect(() => {
    const handleRefresh = async () => {
      try {
        // Get the account_id from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const accountId = urlParams.get('account_id');
        const error = urlParams.get('error');
        
        if (error) {
          logger.error('Stripe connect error', { error });
          setStatus('error');
          return;
        }

        if (accountId) {
          logger.debug('Stripe connect refresh', { accountId });
          setStatus('retry');
          
          // The page never writes to the database; the API reads the status from Stripe.
          await refreshConnectStatus();
          
          // Try to open the mobile app with deep link
          const mobileDeepLink = `bocm://stripe-connect/refresh?account_id=${accountId}`;
          
          // Attempt to open mobile app
          window.location.href = mobileDeepLink;
          
          // Fallback: redirect to web app after a delay
          setTimeout(() => {
            router.push('/barber/onboarding?stripe_refresh=true');
          }, 2000);
        } else {
          setStatus('error');
        }
      } catch (error) {
        logger.error('Error handling Stripe refresh', error);
        setStatus('error');
      }
    };

    handleRefresh();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#272a2f',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {status === 'loading' && (
        <>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Refreshing...</h1>
          <p style={{ fontSize: '16px', opacity: 0.8 }}>Updating your Stripe setup</p>
        </>
      )}
      
      {status === 'retry' && (
        <>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Setup In Progress</h1>
          <p style={{ fontSize: '16px', opacity: 0.8, textAlign: 'center', maxWidth: '300px' }}>
            Your Stripe account setup is still in progress. 
            Redirecting you back to the app...
          </p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Setup Failed</h1>
          <p style={{ fontSize: '16px', opacity: 0.8, textAlign: 'center', maxWidth: '300px' }}>
            There was an issue with your Stripe setup. 
            Please try again or contact support.
          </p>
          <button 
            onClick={() => router.push('/barber/onboarding')}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Return to Onboarding
          </button>
        </>
      )}
    </div>
  );
} 