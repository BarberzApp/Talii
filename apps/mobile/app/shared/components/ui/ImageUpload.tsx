import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, X } from 'lucide-react-native';
import { uploadImageFromUri, type UploadBucket } from '../../lib/uploads';
import { isApiError } from '../../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import tw from 'twrnc';
import { logger } from '../../lib/logger';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onUploadError: (error: string) => void;
  maxImages?: number;
  aspectRatio?: number;
  title?: string;
  description?: string;
  existingImages?: string[];
  onRemoveImage?: (index: number) => void;
  onImagePress?: (imageUrl: string, index: number) => void;
  /** Storage bucket: 'avatars' for profile and cover photos, 'media' for portfolio images. */
  bucket: UploadBucket;
  /** Allow uploading a replacement when maxImages is already reached (single avatar or cover). */
  replace?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onUploadComplete,
  onUploadError,
  maxImages = 1,
  aspectRatio = 1,
  title = 'Upload Image',
  description = 'Select an image from your gallery or take a photo',
  existingImages = [],
  onRemoveImage,
  onImagePress,
  bucket,
  replace = false,
}) => {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [aspectRatio, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri, result.assets[0].mimeType);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      onUploadError('Failed to select image');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [aspectRatio, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri, result.assets[0].mimeType);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      onUploadError('Failed to take photo');
    }
  };

  const uploadImage = async (uri: string, mimeType?: string | null) => {
    if (existingImages.length >= maxImages && !replace) {
      onUploadError(`Maximum ${maxImages} image${maxImages > 1 ? 's' : ''} allowed`);
      return;
    }

    setUploading(true);
    try {
      // POST /api/uploads -> signed upload URL in the caller's folder -> public URL.
      const publicUrl = await uploadImageFromUri(uri, bucket, { mimeType });
      onUploadComplete(publicUrl);
    } catch (error) {
      logger.error('Error uploading image:', error);
      onUploadError(
        isApiError(error) ? error.message : 'Failed to upload image. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Upload Image',
      'Choose how you want to add an image',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
      ]
    );
  };

  return (
    <View style={tw`space-y-4`}>
      {/* Upload Button */}
      {(existingImages.length < maxImages || replace) && (
        <TouchableOpacity
          style={[
            tw`flex-row items-center justify-center p-6 rounded-2xl border-2 border-dashed`,
            { 
              backgroundColor: colors.glass,
              borderColor: 'rgba(255,255,255,0.2)'
            }
          ]}
          onPress={showUploadOptions}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <View style={tw`items-center`}>
              <View style={[
                tw`w-12 h-12 rounded-full items-center justify-center mb-3`,
                { backgroundColor: colors.glassBorder }
              ]}>
                <Upload size={24} color={colors.primary} />
              </View>
              <Text style={[tw`font-semibold text-base`, { color: colors.foreground }]}>
                {title}
              </Text>
              <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                {description}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Existing Images Grid */}
      {existingImages.length > 0 && (
        <View style={tw`space-y-3`}>
          <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
            Uploaded Images ({existingImages.length}/{maxImages})
          </Text>
          <View style={tw`flex-row flex-wrap gap-3`}>
            {existingImages.map((imageUrl, index) => {
              const hasFailed = failedImages.has(index);
              return (
                <View key={index} style={tw`relative`}>
                  {hasFailed ? (
                    <View
                      style={[
                        tw`rounded-xl items-center justify-center`,
                        { 
                          width: 100, 
                          height: 100 / aspectRatio,
                          backgroundColor: colors.glassBorder,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.2)',
                        }
                      ]}
                    >
                      <Camera size={24} color={colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                        Failed to load
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onImagePress?.(imageUrl, index)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ 
                          uri: imageUrl,
                          cache: 'force-cache',
                        }}
                        style={[
                          tw`rounded-xl`,
                          { width: 100, height: 100 / aspectRatio }
                        ]}
                        resizeMode="cover"
                        onError={(error) => {
                          const nativeEvent = error?.nativeEvent as any;
                          const nativeError = nativeEvent?.error || 'Unknown error';
                          const responseCode = nativeEvent?.responseCode;
                          const httpHeaders = nativeEvent?.httpResponseHeaders;
                          logger.error('Image load error:', { 
                            imageUrl, 
                            index, 
                            nativeError,
                            responseCode,
                            httpHeaders,
                            fullError: nativeEvent 
                          });
                          setFailedImages(prev => new Set(prev).add(index));
                        }}
                        onLoad={() => {
                          logger.log('Image loaded successfully:', { imageUrl, index });
                          // Remove from failed set if it loads successfully
                          setFailedImages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(index);
                            return newSet;
                          });
                        }}
                        onLoadStart={() => {
                          logger.log('Image load started:', { imageUrl, index });
                        }}
                      />
                    </TouchableOpacity>
                  )}
                  {onRemoveImage && (
                    <TouchableOpacity
                      style={[
                        tw`absolute -top-2 -right-2 w-6 h-6 rounded-full items-center justify-center`,
                        { backgroundColor: colors.destructive }
                      ]}
                      onPress={() => onRemoveImage(index)}
                    >
                      <X size={14} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}; 