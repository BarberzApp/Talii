'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Badge } from '@/shared/components/ui/badge'
import { BARBER_SPECIALTIES, getFilteredSpecialties } from '@/shared/constants/specialties'

interface SpecialtyAutocompleteProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  maxSelections?: number
  disabled?: boolean
}

export function SpecialtyAutocomplete({
  value = [],
  onChange,
  placeholder = "Search specialties...",
  className,
  maxSelections = 10,
  disabled = false
}: SpecialtyAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredSpecialties = React.useMemo(() => {
    return getFilteredSpecialties(searchQuery)
  }, [searchQuery])

  const handleSelect = (specialty: string) => {
    if (value.includes(specialty)) {
      onChange(value.filter(item => item !== specialty))
    } else if (value.length < maxSelections) {
      onChange([...value, specialty])
    }
    setSearchQuery('')
  }

  const handleRemove = (specialtyToRemove: string) => {
    onChange(value.filter(item => item !== specialtyToRemove))
  }

  const handleClearAll = () => {
    onChange([])
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[48px] p-3 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground backdrop-blur-xl rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all duration-200"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-2 flex-1">
              {value.length === 0 ? (
                <span className="text-foreground/40 font-normal">{placeholder}</span>
              ) : (
                value.map((specialty) => (
                  <Badge
                    key={specialty}
                    variant="secondary"
                    className="text-xs bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 backdrop-blur-xl rounded-lg px-2.5 py-1 flex items-center gap-1.5 group transition-all duration-300"
                  >
                    {specialty}
                    <span
                      className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-secondary/50 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(specialty)
                      }}
                      role="button"
                    >
                      <X className="h-3 w-3 text-secondary/60 group-hover:text-secondary transition-colors" />
                    </span>
                  </Badge>
                ))
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 text-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-gradient-to-br from-white/15 to-white/5 dark:from-white/10 dark:to-white/5 border border-black/10 dark:border-white/20 shadow-2xl backdrop-blur-3xl rounded-2xl overflow-hidden" align="start">
          <Command className="bg-transparent border-0">
            <div className="p-2 border-b border-white/10">
              <CommandInput
                placeholder={placeholder}
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="h-10 bg-white/5 text-foreground placeholder:text-foreground/40 rounded-xl border border-white/5 focus:border-secondary/40 focus:ring-1 focus:ring-secondary/20"
              />
            </div>
            <CommandList className="max-h-[300px] py-1">
              <CommandEmpty className="py-6 text-center text-sm text-foreground/50 font-normal italic">No specialty found.</CommandEmpty>
              <CommandGroup>
                {filteredSpecialties.map((specialty) => (
                  <CommandItem
                    key={specialty}
                    value={specialty}
                    onSelect={() => handleSelect(specialty)}
                    className={cn(
                      "cursor-pointer rounded-xl transition-all px-4 py-3 mx-2 my-1.5 group flex items-center justify-between outline-none",
                      value.includes(specialty)
                        ? "bg-gradient-to-r from-secondary to-secondary/80 text-primary font-bold shadow-lg shadow-secondary/10"
                        : "text-foreground/80 hover:bg-secondary/10 hover:text-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <Check
                          className={cn(
                            "mr-3 h-4 w-4 transition-transform duration-200",
                            value.includes(specialty) ? "scale-110 opacity-100" : "scale-0 opacity-0"
                          )}
                        />
                        <span className="font-medium">{specialty}</span>
                      </div>
                      {!value.includes(specialty) && value.length < maxSelections && (
                        <div className="h-2 w-2 rounded-full bg-secondary/0 group-hover:bg-secondary transition-colors" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/60">
            {value.length} of {maxSelections} selected
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-auto p-1 text-xs text-white/60 hover:text-white"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
} 