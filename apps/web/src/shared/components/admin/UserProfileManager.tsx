'use client'

import { useState } from 'react'
import Image from 'next/image'
import { isOptimizableImage } from '@/shared/lib/image'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import {
  Search,
  User,
  Image as ImageIcon, Loader2,
  X,
  AlertTriangle, Mail,
  Phone,
  Calendar
} from 'lucide-react'
import { api, errorMessage } from '@/shared/lib/api'
import type { AdminUser } from '@barber-app/shared'
import { logger } from '@/shared/lib/logger'

const SEARCH_PAGE_SIZE = 10

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  avatar_url?: string | null
  cover_photo_url?: string | null
  created_at?: string
  barber?: {
    id: string
    portfolio?: string[]
  }
}

export function UserProfileManager() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [results, setResults] = useState<AdminUser[]>([])
  const [resultsTotal, setResultsTotal] = useState(0)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<{ type: string; url: string; id?: string } | null>(null)
  const { toast } = useToast()

  /** Loads one user's photos: portfolio and cover photo come from the public barber profile (listed barbers only). */
  const selectUser = async (profile: AdminUser) => {
    let barberData: UserProfile['barber'] = undefined
    let coverPhoto: string | null = null
    if (profile.barber) {
      barberData = { id: profile.barber.id, portfolio: [] }
      try {
        const pub = await api.barbers.get(profile.barber.id)
        barberData.portfolio = pub.barber.portfolio
        coverPhoto = pub.profile.cover_photo_url
      } catch {
        // Unlisted or suspended: not readable through the public route.
      }
    }
    setUserProfile({
      id: profile.id,
      name: profile.name || profile.username,
      email: profile.email ?? '',
      phone: profile.phone,
      role: profile.role,
      avatar_url: profile.avatar_url,
      cover_photo_url: coverPhoto,
      created_at: profile.created_at,
      barber: barberData,
    })
  }

  /** GET /api/admin/users?q= (name, username or email), paged; one match opens directly. */
  const searchUser = async (more = false) => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Search Required',
        description: 'Please enter a name, username or email to search',
        variant: 'destructive',
      })
      return
    }

    setSearching(true)
    try {
      const offset = more ? results.length : 0
      const { users, pagination } = await api.admin.listUsers({ q: searchTerm.trim(), limit: SEARCH_PAGE_SIZE, offset })
      const all = more ? [...results, ...users] : users
      setResults(all)
      setResultsTotal(pagination.total)

      if (!more) {
        setUserProfile(null)
        if (users.length === 0) {
          toast({
            title: 'User Not Found',
            description: 'No user found with that name, username or email',
            variant: 'destructive',
          })
        } else if (pagination.total === 1) {
          await selectUser(users[0])
        }
      }
    } catch (error) {
      logger.error('Error searching user', error)
      toast({
        title: 'Search Failed',
        description: errorMessage(error, 'Failed to search user'),
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleDeletePhoto = (type: string, url: string, id?: string) => {
    setPhotoToDelete({ type, url, id })
    setDeleteConfirmOpen(true)
  }

  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !userProfile) return

    setDeletingPhoto(photoToDelete.url)
    try {
      // DELETE /api/admin/media removes the file and clears it from the profile/portfolio.
      await api.admin.deleteMedia(photoToDelete.url)

      // Update local state
      if (photoToDelete.type === 'avatar') {
        setUserProfile({ ...userProfile, avatar_url: null })
      } else if (photoToDelete.type === 'cover') {
        setUserProfile({ ...userProfile, cover_photo_url: null })
      } else if (photoToDelete.type === 'portfolio' && userProfile.barber) {
        setUserProfile({
          ...userProfile,
          barber: {
            ...userProfile.barber,
            portfolio: userProfile.barber.portfolio?.filter(p => p !== photoToDelete.url) || [],
          },
        })
      }

      toast({
        title: 'Photo Deleted',
        description: 'Photo has been successfully deleted',
      })
    } catch (error) {
      logger.error('Error deleting photo', error)
      toast({
        title: 'Delete Failed',
        description: errorMessage(error, 'Failed to delete photo'),
        variant: 'destructive',
      })
    } finally {
      setDeletingPhoto(null)
      setDeleteConfirmOpen(false)
      setPhotoToDelete(null)
    }
  }

  const getPhotoTypeLabel = (type: string) => {
    switch (type) {
      case 'avatar':
        return 'Avatar'
      case 'cover':
        return 'Cover Photo'
      case 'portfolio':
        return 'Portfolio Image'
      default:
        return 'Photo'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile & Photo Manager
          </CardTitle>
          <CardDescription className="text-white/80">
            Search for users by email or ID and manage their photos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                type="text"
                placeholder="Search by name, username or email..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && searchUser()}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <Button
              onClick={() => searchUser()}
              disabled={searching}
              className="bg-secondary text-primary hover:bg-secondary/90"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Search results (pick one) */}
          {results.length > 1 && (
            <div className="mt-4 space-y-2">
              <p className="text-white/60 text-sm">{resultsTotal} matches</p>
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectUser(u)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                    userProfile?.id === u.id ? 'border-white/40 bg-white/10' : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span className="text-white font-medium">{u.name || u.username}</span>
                  <span className="text-white/50"> @{u.username} · {u.email ?? 'no email'} · {u.role}</span>
                </button>
              ))}
              {results.length < resultsTotal && (
                <Button variant="outline" size="sm" onClick={() => searchUser(true)} disabled={searching} className="border-white/20 text-white">
                  Load more
                </Button>
              )}
            </div>
          )}

          {/* User Profile Display */}
          {userProfile && (
            <Card className="bg-white/5 border-white/10 mt-4">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-start gap-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={userProfile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-primary text-xl">
                        {userProfile.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{userProfile.name}</h3>
                        <Badge className={userProfile.role === 'barber' ? 'bg-blue-500' : 'bg-gray-500'}>
                          {userProfile.role.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-white/80">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{userProfile.email}</span>
                        </div>
                        {userProfile.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{userProfile.phone}</span>
                          </div>
                        )}
                        {userProfile.created_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Joined: {new Date(userProfile.created_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Avatar */}
                  {userProfile.avatar_url && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Avatar
                      </h4>
                      <div className="relative inline-block">
                        <Image
                          src={userProfile.avatar_url}
                          unoptimized={!isOptimizableImage(userProfile.avatar_url)}
                          alt="Avatar"
                          width={96}
                          height={96}
                          className="w-24 h-24 object-cover rounded-lg border-2 border-white/20"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => handleDeletePhoto('avatar', userProfile.avatar_url!)}
                          disabled={deletingPhoto === userProfile.avatar_url}
                        >
                          {deletingPhoto === userProfile.avatar_url ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Cover Photo */}
                  {userProfile.cover_photo_url && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Cover Photo
                      </h4>
                      <div className="relative inline-block">
                        <Image
                          src={userProfile.cover_photo_url}
                          unoptimized={!isOptimizableImage(userProfile.cover_photo_url)}
                          alt="Cover"
                          width={192}
                          height={128}
                          className="w-48 h-32 object-cover rounded-lg border-2 border-white/20"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => handleDeletePhoto('cover', userProfile.cover_photo_url!)}
                          disabled={deletingPhoto === userProfile.cover_photo_url}
                        >
                          {deletingPhoto === userProfile.cover_photo_url ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Portfolio (Barbers only) */}
                  {userProfile.barber && userProfile.barber.portfolio && userProfile.barber.portfolio.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Portfolio Images ({userProfile.barber.portfolio.length})
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        {userProfile.barber.portfolio.map((url, index) => (
                          <div key={index} className="relative h-32">
                            <Image
                              src={url}
                              unoptimized={!isOptimizableImage(url)}
                              alt={`Portfolio ${index + 1}`}
                              fill
                              sizes="(min-width: 1024px) 200px, 25vw"
                              className="object-cover rounded-lg border-2 border-white/20"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0"
                              onClick={() => handleDeletePhoto('portfolio', url)}
                              disabled={deletingPhoto === url}
                            >
                              {deletingPhoto === url ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!userProfile.avatar_url && !userProfile.cover_photo_url && 
                   (!userProfile.barber || userProfile.barber.portfolio?.length === 0) && (
                    <div className="text-center py-8 text-white/60">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No photos found for this user</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-darkpurple border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Photo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to delete this {photoToDelete ? getPhotoTypeLabel(photoToDelete.type) : 'photo'}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePhoto}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

