import { theme } from '../lib/theme';

/**
 * Generates initials from a name
 * @param name - Full name or username
 * @returns Initials (max 2 characters)
 */
export function getInitials(name?: string | null): string {
  if (!name || name.trim().length === 0) {
    return 'U';
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generates a deterministic color based on a string (name)
 * This ensures the same name always gets the same color
 * @param str - String to generate color from
 * @returns Hex color string
 */
export function getColorFromString(str?: string | null): string {
  if (!str || str.length === 0) {
    return theme.colors.primary; // Default saffron brown
  }

  // Generate a hash from the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use theme colors as base palette
  const colors = [
    theme.colors.primary, // Saffron brown
    theme.colors.accent, // Coffee brown
    '#8B4513', // Saddle brown
    '#A0522D', // Sienna
    '#CD853F', // Peru
    '#D2691E', // Chocolate
    '#B8860B', // Dark goldenrod
    '#DAA520', // Goldenrod
  ];

  // Use hash to select a color from the palette
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Avatar fallback props for rendering
 */
export interface AvatarFallbackProps {
  initials: string;
  backgroundColor: string;
  textColor?: string;
}

/**
 * Gets avatar fallback props
 * @param name - User name
 * @returns Avatar fallback props
 */
export function getAvatarFallbackProps(name?: string | null): AvatarFallbackProps {
  return {
    initials: getInitials(name),
    backgroundColor: getColorFromString(name),
    textColor: theme.colors.foreground,
  };
}
