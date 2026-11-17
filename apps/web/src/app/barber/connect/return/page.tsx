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

export default function StripeConnectReturn() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleReturn = async () => {
      try {
        // Get the account_id from URL params using URLSearchParams
        const urlParams = new URLSearchParams(window.location.search);
        const accountId = urlParams.get('account_id');
        const error = urlParams.get('error');
        
        if (error) {
          logger.error('Stripe connect error', { error });
          setStatus('error');
          return;
        }

        if (accountId) {
          logger.debug('Stripe connect successful', { accountId });
          setStatus('success');
          
          // The page never writes to the database; the API reads the status from Stripe.
          await refreshConnectStatus();
          
          // Try to open the mobile app with deep link
          const mobileDeepLink = `bocm://stripe-connect/return?account_id=${accountId}`;
          
          logger.debug('Attempting to redirect to mobile app', { mobileDeepLink });
          
          // Try multiple methods to open the mobile app
          try {
            // Method 1: Direct location change (immediate)
            window.location.href = mobileDeepLink;
            
            // Method 2: Try again after a short delay (for iOS Safari)
            setTimeout(() => {
              window.location.href = mobileDeepLink;
            }, 100);
            
            // Method 3: Create a hidden iframe (fallback)
            setTimeout(() => {
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = mobileDeepLink;
              document.body.appendChild(iframe);
              
              // Remove iframe after a short delay
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              }, 1000);
            }, 500);
            
            // Method 4: Try window.open as another fallback
            setTimeout(() => {
              window.open(mobileDeepLink, '_self');
            }, 1000);
            
            // Method 5: Try window.location.replace (more aggressive)
            setTimeout(() => {
              window.location.replace(mobileDeepLink);
            }, 1500);
            
          } catch (error) {
            logger.error('Error redirecting to mobile app', error);
          }
          
          // Fallback: redirect to web app after a longer delay
          setTimeout(() => {
            logger.debug('Fallback: redirecting to web app');
            router.push('/barber/onboarding?stripe_success=true');
          }, 3000);
        } else {
          setStatus('error');
        }
      } catch (error) {
        logger.error('Error handling Stripe return', error);
        setStatus('error');
      }
    };

    handleReturn();
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
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Processing...</h1>
          <p style={{ fontSize: '16px', opacity: 0.8 }}>Completing your Stripe setup</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Setup Complete!</h1>
          <p style={{ fontSize: '16px', opacity: 0.8, textAlign: 'center', maxWidth: '300px', marginBottom: '24px' }}>
            Your Stripe account has been successfully connected. 
            Redirecting you back to the app...
          </p>
          <button 
            onClick={() => {
              const mobileDeepLink = `bocm://stripe-connect/return?account_id=${new URLSearchParams(window.location.search).get('account_id')}`;
              window.location.href = mobileDeepLink;
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            Return to App
          </button>
          <p style={{ fontSize: '14px', opacity: 0.6 }}>
            If the app doesn't open automatically, tap the button above
          </p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Setup Failed</h1>
          <p style={{ fontSize: '16px', opacity: 0.8, textAlign: 'center', maxWidth: '300px' }}>
            There was an issue completing your Stripe setup. 
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