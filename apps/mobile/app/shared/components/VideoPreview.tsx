import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Avatar } from './ui';
import tw from 'twrnc';
import { useTheme } from './theme/ThemeProvider';
import { logger } from '../lib/logger';

const { width } = Dimensions.get('window');

interface VideoPreviewProps {
  videoUrl: string;
  barberName: string;
  barberAvatar?: string;
  onPress?: () => void;
  width?: number;
  height?: number;
}

export default function VideoPreview({
  videoUrl,
  barberName,
  barberAvatar,
  onPress,
  width: customWidth,
  height: customHeight,
}: VideoPreviewProps) {
  const { colors } = useTheme();
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const videoWidth = customWidth || (width - 32) / 3;
  const videoHeight = customHeight || videoWidth * 1.5;

  useEffect(() => {
    if (videoUrl) {
      setIsLoading(true);
      setFrameUrl(videoUrl);
      setIsLoading(false);
    }
  }, [videoUrl]);

  return (
    <TouchableOpacity
      style={[
        tw`mb-2 rounded-lg overflow-hidden`,
        {
          width: videoWidth,
          height: videoHeight,
          borderColor: colors.glassBorder,
          borderWidth: 1,
          backgroundColor: colors.glass,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[tw`w-full h-full relative`, { backgroundColor: colors.muted }]}>
        {frameUrl && !isLoading ? (
          <Video
            source={{ uri: frameUrl }}
            style={tw`w-full h-full`}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted={true}
            isLooping={false}
            onError={(error) => {
              logger.log('Video load error:', error);
              setFrameUrl(null);
            }}
          />
        ) : (
          <View style={[
            tw`w-full h-full items-center justify-center`, 
            { backgroundColor: colors.muted }
          ]}>
            <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
              Loading...
            </Text>
          </View>
        )}

        {/* Barber Avatar - Bottom Right */}
        <View style={tw`absolute bottom-2 right-2`}>
          <Avatar
            size="sm"
            src={barberAvatar}
            fallback={barberName?.charAt(0)}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
