import { Metadata } from 'next'
import { getBarberProfile } from '@/server/discovery'
import { logger } from '@/shared/lib/logger'

const DEFAULT_OG_IMAGE = `${process.env.NEXT_PUBLIC_APP_URL || ''}/brand/talii-logo.png`

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  let username = ''
  try {
    const resolvedParams = await params
    username = resolvedParams.username
    // Server component: read the public profile with the same code as
    // GET /api/barbers/by-username/:username (no caller, so no block filtering).
    let found: Awaited<ReturnType<typeof getBarberProfile>> | null = null
    let error: unknown = null
    if (/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      try {
        found = await getBarberProfile({ username }, null)
      } catch (e) {
        error = e
      }
    }
    const barberData = found
    const atUsername = username ? `@${username}` : 'Barber'

    if (error || !barberData) {
       return {
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        openGraph: {
          title: `${atUsername} - BOCM Style`,
          description: 'Book your next haircut with a professional barber on BOCM Style.',
          type: 'website',
          url: `https://bocmstyle.com/book/${username}`,
          images: [
            {
              url: DEFAULT_OG_IMAGE,
              width: 1200,
              height: 630,
              alt: 'BOCM Style - Professional Barber Booking',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${atUsername} - BOCM Style`,
          description: 'Book your next haircut with a professional barber on BOCM Style.',
          images: [DEFAULT_OG_IMAGE],
        },
      }
    }

    const barber = barberData.barber
    const profile = barberData.profile
    const barberName = profile.name || barber.business_name || atUsername
    const barberBio = barber.bio || 'Professional barber offering quality haircuts and styling services.'
    const barberLocation = [barber.city, barber.state].filter(Boolean).join(', ')
    const barberImage = profile.avatar_url || profile.cover_photo_url || DEFAULT_OG_IMAGE
    
    // Create specialties text
    const specialtiesText = barber.specialties && barber.specialties.length > 0 
      ? `Specializing in ${barber.specialties.join(', ')}` 
      : ''

    const fullDescription = `${barberBio}${barberLocation ? ` Located in ${barberLocation}.` : ''} ${specialtiesText} Book your appointment today!`

    return {
      title: `${atUsername} - BOCM Style`,
      description: fullDescription,
      openGraph: {
        title: `${atUsername} - BOCM Style`,
        description: fullDescription,
        type: 'website',
        url: `https://bocmstyle.com/book/${username}`,
        images: [
          {
            url: barberImage,
            width: 1200,
            height: 630,
            alt: `${barberName} - Professional Barber`,
          },
        ],
        siteName: 'BOCM Style',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} - BOCM Style`,
        description: fullDescription,
        images: [barberImage],
        creator: '@bocmstyle',
      },
      other: {
        'theme-color': '#FF6B35', // Saffron color
        'msapplication-TileColor': '#FF6B35',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'black-translucent',
      },
    }
  } catch (error) {
    logger.error('Error generating metadata', error)
    
    // Fallback metadata
    const atUsername = username ? `@${username}` : 'Barber'
    return {
      title: `${atUsername} - BOCM Style`,
      description: 'Book your next haircut with a professional barber on BOCM Style.',
      openGraph: {
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        type: 'website',
        url: `https://bocmstyle.com/book/${username}`,
        images: [
          {
            url: DEFAULT_OG_IMAGE,
            width: 1200,
            height: 630,
            alt: 'BOCM Style - Professional Barber Booking',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        images: [DEFAULT_OG_IMAGE],
      },
    }
  }
}

export default function BookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 