import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/components/ui/use-toast'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Loader2, Plus, Edit, Trash2, Package, AlertCircle, CheckCircle, DollarSign, Sparkles, ToggleLeft } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { ServiceAddon, CreateServiceAddonInput, UpdateServiceAddonInput } from '@/shared/types/addon'
import { logger } from '@/shared/lib/logger'

interface AddonsSettingsProps {
  onUpdate?: () => void
}

interface AddonFormData {
  name: string
  description: string
  price: number
  is_active: boolean
}

export function AddonsSettings({ onUpdate }: AddonsSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<AddonFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      is_active: true
    }
  })

  const isActive = watch('is_active')

  useEffect(() => {
    if (user) {
      loadBarberId()
    }
  }, [user])

  useEffect(() => {
    if (barberId) {
      loadAddons(barberId)
    }
  }, [barberId])

  const loadBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      setBarberId(data.id)
    } catch (error) {
      logger.error('Error loading barber ID', error)
      toast({
        title: 'Error',
        description: 'Failed to load barber information.',
        variant: 'destructive',
      })
    }
  }

  const loadAddons = async (barberId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .order('name')

      if (error) throw error
      setAddons(data || [])
    } catch (error) {
      logger.error('Error loading add-ons', error)
      toast({
        title: 'Error',
        description: 'Failed to load add-ons. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const onSubmit = async (data: AddonFormData) => {
    if (!barberId) {
      toast({
        title: 'Error',
        description: 'Barber information not found.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      if (editingAddon) {
        const { error: updateError } = await supabase
          .from('service_addons')
          .update({
            name: data.name,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAddon.id)

        if (updateError) {
          logger.error('Error updating add-on', updateError)
          toast({
            title: 'Error',
            description: 'Failed to update add-on. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Add-on updated successfully',
        })
      } else {
        const { error: insertError } = await supabase
          .from('service_addons')
          .insert({
            barber_id: barberId,
            name: data.name,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
          })

        if (insertError) {
          logger.error('Error creating add-on', insertError)
          toast({
            title: 'Error',
            description: 'Failed to create add-on. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Add-on added successfully',
        })
      }

      await loadAddons(barberId)
      reset()
      setEditingAddon(null)
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving add-on', error)
      toast({
        title: 'Error',
        description: 'Failed to save add-on. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (addon: ServiceAddon) => {
    setEditingAddon(addon)
    setValue('name', addon.name)
    setValue('description', addon.description || '')
    setValue('price', addon.price)
    setValue('is_active', addon.is_active)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return

    try {
      const { error } = await supabase
        .from('service_addons')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Add-on deleted successfully',
      })

      await loadAddons(barberId!)
    } catch (error) {
      logger.error('Error deleting add-on', error)
      toast({
        title: 'Error',
        description: 'Failed to delete add-on. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setEditingAddon(null)
    reset()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
            <Package className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">
              Add-ons Management
            </h2>
            <p className="text-foreground/70 text-lg mt-2">Create and manage optional upgrades for your services</p>
          </div>
        </div>
      </div>

      {/* Add / Edit Form */}
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
          <CardTitle className="text-foreground flex items-center gap-3 text-2xl">
            {editingAddon ? (
              <>
                <div className="p-2 bg-secondary/20 rounded-xl">
                  <Edit className="h-6 w-6 text-secondary" />
                </div>
                Edit Add-on
              </>
            ) : (
              <>
                <div className="p-2 bg-secondary/20 rounded-xl">
                  <Plus className="h-6 w-6 text-secondary" />
                </div>
                Add New Add-on
              </>
            )}
          </CardTitle>
          <CardDescription className="text-foreground/70 text-base">
            {editingAddon
              ? 'Update your add-on details and pricing'
              : 'Add extras like premium products, towels, or special treatments'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="addon-name" className="text-foreground font-semibold text-lg flex items-center gap-2">
                  <Package className="h-4 w-4 text-secondary" />
                  Add-on Name *
                </Label>
                <Input
                  id="addon-name"
                  {...register('name', { required: 'Name is required' })}
                  placeholder="e.g., Fresh Towel, Premium Shampoo"
                  className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary rounded-xl h-12 text-lg"
                />
                {errors.name && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="addon-price" className="text-foreground font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-secondary" />
                  Price ($) *
                </Label>
                <Input
                  id="addon-price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('price', {
                    required: 'Price is required',
                    min: { value: 0, message: 'Price must be positive' }
                  })}
                  placeholder="5.00"
                  className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary rounded-xl h-12 text-lg"
                />
                {errors.price && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="addon-description" className="text-foreground font-semibold text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                Description (Optional)
              </Label>
              <Textarea
                id="addon-description"
                {...register('description')}
                placeholder="Brief description of what this add-on includes..."
                className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary rounded-xl text-lg min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked: boolean) => setValue('is_active', checked)}
              />
              <div>
                <Label htmlFor="is_active" className="text-foreground font-semibold cursor-pointer">
                  Active
                </Label>
                <p className="text-foreground/60 text-sm">Available for clients to add at booking</p>
              </div>
              <Badge
                variant="secondary"
                className={`ml-auto ${isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="flex gap-4 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-secondary hover:bg-secondary/90 text-primary-foreground font-semibold shadow-xl rounded-xl px-10 py-4 text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                {editingAddon ? 'Update Add-on' : 'Add Add-on'}
              </Button>

              {editingAddon && (
                <Button
                  type="button"
                  onClick={handleCancel}
                  variant="outline"
                  className="border-black/10 dark:border-white/20 text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-xl px-8 py-3 text-lg"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add-ons List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/20 rounded-xl">
              <Package className="h-5 w-5 text-secondary" />
            </div>
            <h3 className="text-2xl font-bebas text-foreground tracking-wide">Your Add-ons</h3>
          </div>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-secondary/20 text-secondary border-secondary/30">
            {addons.length} {addons.length === 1 ? 'Add-on' : 'Add-ons'}
          </Badge>
        </div>

        {addons.length === 0 ? (
          <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-xl backdrop-blur-xl rounded-3xl">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center gap-6">
                <div className="p-6 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-3xl">
                  <Sparkles className="h-12 w-12 text-secondary" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-2xl font-bebas text-foreground tracking-wide">No Add-ons Yet</h4>
                  <p className="text-foreground/60 text-lg">Add your first add-on to start offering premium extras</p>
                </div>
                <Button
                  onClick={() => document.getElementById('addon-name')?.focus()}
                  className="bg-secondary hover:bg-secondary/90 text-primary-foreground font-semibold shadow-xl rounded-xl px-10 py-4 text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Add-on
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {addons.map((addon) => (
              <Card
                key={addon.id}
                className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-xl backdrop-blur-xl hover:shadow-2xl hover:border-secondary/20 transition-all duration-300 rounded-3xl group"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-xl font-bebas text-foreground tracking-wide">{addon.name}</h4>
                        <Badge
                          variant="secondary"
                          className="text-sm px-3 py-1 bg-secondary/20 text-secondary border-secondary/30"
                        >
                          ${addon.price.toFixed(2)}
                        </Badge>
                        <Badge
                          variant={addon.is_active ? 'default' : 'secondary'}
                          className={addon.is_active
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                        >
                          {addon.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {addon.description && (
                        <p className="text-foreground/70 text-base leading-relaxed">{addon.description}</p>
                      )}
                    </div>

                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(addon)}
                        className="text-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-xl p-3"
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(addon.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl p-3"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tips Section */}
      <Card className="bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent border border-secondary/20 shadow-xl backdrop-blur-xl rounded-3xl">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl">
              <Sparkles className="h-6 w-6 text-secondary" />
            </div>
            <div className="space-y-4">
              <h4 className="text-xl font-bebas text-foreground tracking-wide">Pro Tips for Add-ons</h4>
              <ul className="text-foreground/70 space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Offer premium products clients can't easily get themselves</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Keep add-on pricing reasonable to encourage upsells</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Use descriptive names so clients know exactly what they're getting</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Disable add-ons temporarily if you run out of stock</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}