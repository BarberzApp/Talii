import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Sun, Moon, Smartphone } from 'lucide-react-native';
import { useTheme } from './ThemeProvider';
import { theme } from '../../lib/theme';
import type { ThemePreference } from '../../lib/themeStorage';

export function ThemeToggle() {
  const { colors, themePreference, setColorScheme } = useTheme();

  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Smartphone },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.foreground,
          marginBottom: 12,
        }}
      >
        Appearance
      </Text>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: theme.borderRadius.xl,
          backgroundColor: colors.muted,
          padding: 4,
        }}
      >
        {options.map(({ value, label, icon: Icon }) => {
          const isActive = themePreference === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setColorScheme(value)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: theme.borderRadius.lg,
                backgroundColor: isActive ? colors.primary : 'transparent',
              }}
            >
              <Icon
                size={18}
                color={isActive ? colors.primaryForeground : colors.mutedForeground}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isActive ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
