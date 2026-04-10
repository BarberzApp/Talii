import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { AnimatedText } from '../AnimatedText';
import { GlassyCard, GlassyCardContent } from '../ui/GlassyCard';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { MapPin, Star, Heart, Search, Filter } from 'lucide-react-native';

interface MobileHeroProps {
  title: string;
  subtitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const MobileHero: React.FC<MobileHeroProps> = ({ title, subtitle, containerStyle }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[tw`items-center px-6 py-8`, containerStyle]}>
      <AnimatedText 
        text={title} 
        type="title" 
        delay={100}
        style={tw`text-center mb-2`}
      />
      {subtitle && (
        <AnimatedText 
          text={subtitle} 
          type="bebas" 
          delay={600}
          style={[tw`text-center`, { color: colors.primary }]}
        />
      )}
    </View>
  );
};

export const ServiceCardVisual: React.FC = () => {
  const { colors } = useTheme();
  
  return (
    <GlassyCard style={tw`w-64 rounded-3xl self-center my-6 overflow-hidden shadow-2xl`}>
      <View style={tw`h-48 bg-muted overflow-hidden`}>
        {/* Placeholder image representation */}
        <View style={[tw`absolute inset-0 items-center justify-center`, { backgroundColor: colors.primarySubtle }]}>
          <Star size={48} color={colors.primary} style={{ opacity: 0.2 }} />
        </View>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop' }} 
          style={tw`w-full h-full`}
          resizeMode="cover"
        />
        <View style={tw`absolute top-3 right-3`}>
          <GlassyCard intensity={40} style={tw`p-2 rounded-full`}>
            <Heart size={16} color={colors.destructive} fill={colors.destructive} />
          </GlassyCard>
        </View>
      </View>
      <GlassyCardContent style={tw`p-4`}>
        <View style={tw`flex-row justify-between items-center mb-1`}>
          <Text style={[tw`text-lg font-bold`, { color: colors.foreground }]}>Classic Fade</Text>
          <Text style={[tw`text-lg font-bold`, { color: colors.primary }]}>$45</Text>
        </View>
        <View style={tw`flex-row items-center`}>
          <MapPin size={12} color={colors.mutedForeground} />
          <Text style={[tw`text-xs ml-1`, { color: colors.mutedForeground }]}>Downtown Stylists</Text>
        </View>
        <View style={tw`flex-row items-center mt-2`}>
          <View style={tw`flex-row mr-2`}>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <Star key={i} size={10} fill={colors.premium} color={colors.premium} />
            ))}
          </View>
          <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>5.0 (42 reviews)</Text>
        </View>
      </GlassyCardContent>
    </GlassyCard>
  );
};

interface AuthTrayProps {
  onStart: () => void;
  onLogin: () => void;
}

export const AuthTray: React.FC<AuthTrayProps> = ({ onStart, onLogin }) => {
  const { colors } = useTheme();
  
  return (
    <GlassyCard style={tw`mx-6 mb-8 rounded-3xl overflow-hidden`}>
      <GlassyCardContent style={tw`p-4`}>
        <AnimatedPressable
          onPress={onStart}
          style={[
            tw`w-full py-4 rounded-2xl items-center mb-3 shadow-lg`,
            { backgroundColor: colors.primary }
          ]}
        >
          <Text style={[tw`text-lg font-bold`, { color: colors.primaryForeground }]}>
            Start Your Journey
          </Text>
        </AnimatedPressable>
        
        <TouchableOpacity 
          onPress={onLogin}
          style={tw`w-full py-2 items-center`}
        >
          <Text style={[tw`text-base font-medium`, { color: colors.mutedForeground }]}>
            Already have an account? <Text style={{ color: colors.primary }}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </GlassyCardContent>
    </GlassyCard>
  );
};

interface WebStyleSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
}

export const WebStyleSearchBar: React.FC<WebStyleSearchBarProps> = ({ value, onChangeText, onFilterPress }) => {
  const { colors } = useTheme();
  
  return (
    <GlassyCard style={tw`mx-6 mt-4 rounded-2xl overflow-hidden`}>
      <View style={tw`flex-row items-center px-4 py-3`}>
        <Search size={20} color={colors.mutedForeground} style={tw`mr-3`} />
        <Text 
          style={[tw`flex-1 text-base`, { color: value ? colors.foreground : colors.mutedForeground }]}
          numberOfLines={1}
        >
          {value || "Search by name, location, or specialty..."}
        </Text>
        {onFilterPress && (
          <TouchableOpacity 
            onPress={onFilterPress} 
            style={[tw`ml-3 pl-3 border-l`, { borderLeftColor: colors.glassBorder }]}
          >
            <Filter size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </GlassyCard>
  );
};
