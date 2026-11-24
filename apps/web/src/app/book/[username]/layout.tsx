import { Metadata } from 'next'
import { getBarberProfile } from '@/server/discovery'
import { logger } from '@/shared/lib/logger'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
const DEFAULT_OG_IMAGE = `${APP_URL}/brand/talii-logo.png`
const GENERIC_DESCRIPTION = 'Book your next haircut with a professional barber on Talii.'

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
        title: `${atUsername} on Talii`,
        description: GENERIC_DESCRIPTION,
        openGraph: {
          title: `${atUsername} on Talii`,
          description: GENERIC_DESCRIPTION,
          type: 'website',
          url: `${APP_URL}/book/${username}`,
          images: [
            {
              url: DEFAULT_OG_IMAGE,
              width: 1200,
              height: 630,
              alt: 'Talii - barber booking',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${atUsername} on Talii`,
          description: GENERIC_DESCRIPTION,
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
      title: `${atUsername} on Talii`,
      description: fullDescription,
      openGraph: {
        title: `${atUsername} on Talii`,
        description: fullDescription,
        type: 'website',
        url: `${APP_URL}/book/${username}`,
        images: [
          {
            url: barberImage,
            width: 1200,
            height: 630,
            alt: `${barberName} - Professional Barber`,
          },
        ],
        siteName: 'Talii',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} on Talii`,
        description: fullDescription,
        images: [barberImage],
      },
    }
  } catch (error) {
    logger.error('Error generating metadata', error)
    
    // Fallback metadata
    const atUsername = username ? `@${username}` : 'Barber'
    return {
      title: `${atUsername} on Talii`,
      description: GENERIC_DESCRIPTION,
      openGraph: {
        title: `${atUsername} on Talii`,
        description: GENERIC_DESCRIPTION,
        type: 'website',
        url: `${APP_URL}/book/${username}`,
        images: [
          {
            url: DEFAULT_OG_IMAGE,
            width: 1200,
            height: 630,
            alt: 'Talii - barber booking',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} on Talii`,
        description: GENERIC_DESCRIPTION,
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