import React, { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AccordionItem({ title, children, defaultExpanded = false, style }: AccordionItemProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [bodyHeight, setBodyHeight] = useState(0);

  const animatedHeight = useSharedValue(defaultExpanded ? 1 : 0);

  const toggle = () => {
    setExpanded(!expanded);
    animatedHeight.value = withTiming(expanded ? 0 : 1, { duration: 300 });
  };

  const bodyStyle = useAnimatedStyle(() => ({
    height: bodyHeight > 0 
      ? withTiming(expanded ? bodyHeight : 0, { duration: 300 })
      : undefined,
    opacity: withTiming(expanded ? 1 : 0, { duration: 300 }),
    overflow: 'hidden'
  }));

  const iconStyle = useAnimatedStyle(() => {
    const rotation = interpolate(animatedHeight.value, [0, 1], [0, 180], Extrapolation.CLAMP);
    return {
      transform: [{ rotate: `${rotation}deg` }]
    };
  });

  return (
    <View style={[{ borderBottomWidth: 1, borderColor: colors.border }, style]}>
      <TouchableOpacity 
        style={tw`py-4 flex-row justify-between items-center`} 
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
          {title}
        </Text>
        <Animated.View style={iconStyle}>
          <ChevronDown size={20} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>
      
      <Animated.View style={[bodyStyle]}>
        <View 
          onLayout={(e: LayoutChangeEvent) => {
            const height = e.nativeEvent.layout.height;
            if (height > 0 && bodyHeight === 0) setBodyHeight(height);
          }}
          style={tw`pb-4 absolute top-0 w-full opacity-0`}
          pointerEvents="none"
        >
          {children}
        </View>

        <View style={tw`pb-4`}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

export function Accordion({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}
