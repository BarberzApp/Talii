import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Star, Send, X } from 'lucide-react-native';
import tw from 'twrnc';
import { useReviews } from '../hooks/useReviews';
import { logger } from '../lib/logger';
import { validateReviewContent, sanitizeText } from '../lib/contentModeration';
import { useTheme } from './theme';

interface ReviewFormProps {
  barberId: string;
  bookingId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  initialRating?: number;
  initialComment?: string;
  isEditing?: boolean;
  reviewId?: string;
}

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] as const;

export function ReviewForm({
  barberId,
  bookingId,
  onClose,
  onSuccess,
  initialRating = 0,
  initialComment = '',
  isEditing = false,
  reviewId,
}: ReviewFormProps) {
  const { colors } = useTheme();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const { submitReview, updateReview, submitting } = useReviews(barberId);

  const translateY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment) {
      const validation = validateReviewContent(trimmedComment);
      if (!validation.isValid) {
        Alert.alert(
          'Content Not Allowed',
          validation.reason || 'Your review contains inappropriate content. Please revise your review.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const sanitizedComment = sanitizeText(trimmedComment);
      
      try {
        if (isEditing && reviewId) {
          await updateReview(reviewId, { rating, comment: sanitizedComment });
        } else {
          await submitReview({
            barberId,
            bookingId,
            rating,
            comment: sanitizedComment || undefined,
          });
        }
        
        onSuccess?.();
        onClose();
      } catch (error) {
        logger.error('Error submitting review:', error);
      }
    } else {
      try {
        if (isEditing && reviewId) {
          await updateReview(reviewId, { rating, comment: '' });
        } else {
          await submitReview({
            barberId,
            bookingId,
            rating,
            comment: undefined,
          });
        }
        
        onSuccess?.();
        onClose();
      } catch (error) {
        logger.error('Error submitting review:', error);
      }
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.backdrop }]}>
      <Animated.View
        style={[
          tw`flex-1 mt-12 rounded-t-3xl px-6 pt-6 pb-8`,
          {
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Swipe handle */}
        <View {...panResponder.panHandlers} style={tw`items-center pb-4`}>
          <View style={[tw`w-10 h-1 rounded-full`, { backgroundColor: colors.border }]} />
        </View>

        {/* Header */}
        <View style={tw`flex-row items-center justify-between mb-6`}>
          <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
            {isEditing ? 'Edit Your Review' : 'Write a Review'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[tw`p-2 rounded-full`, { backgroundColor: colors.muted }]}
          >
            <X size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Rating Section */}
          <View style={[
            tw`p-5 rounded-2xl mb-6`,
            { backgroundColor: colors.primarySubtle }
          ]}>
            <Text style={[tw`text-base font-semibold text-center mb-4`, { color: colors.foreground }]}>
              How was your experience?
            </Text>
            <View style={tw`flex-row justify-center`}>
              {Array.from({ length: 5 }, (_, index) => {
                const isActive = index < rating;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setRating(index + 1)}
                    style={[
                      tw`mx-1.5 p-2 rounded-xl`,
                      isActive && { backgroundColor: 'rgba(245, 158, 11, 0.15)' }
                    ]}
                  >
                    <Star
                      size={36}
                      fill={isActive ? colors.premium : 'transparent'}
                      color={isActive ? colors.premium : colors.border}
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {rating > 0 && (
              <View style={tw`items-center mt-3`}>
                <View style={[tw`px-4 py-1.5 rounded-full`, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[tw`text-sm font-bold`, { color: colors.primary }]}>
                    {ratingLabels[rating]}
                  </Text>
                </View>
              </View>
            )}
            {rating === 0 && (
              <Text style={[tw`text-sm text-center mt-3`, { color: colors.mutedForeground }]}>
                Tap a star to rate
              </Text>
            )}
          </View>

          {/* Comment Section */}
          <View style={tw`mb-6`}>
            <Text style={[tw`text-base font-semibold mb-3`, { color: colors.foreground }]}>
              Share your experience
            </Text>
            <View style={[
              tw`rounded-2xl overflow-hidden`,
              {
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }
            ]}>
              <TextInput
                style={[
                  tw`p-4 text-base`,
                  {
                    color: colors.foreground,
                    minHeight: 120,
                    textAlignVertical: 'top',
                  },
                ]}
                placeholder="What made this visit great? Any highlights?"
                placeholderTextColor={colors.mutedForeground}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
              />
              <View style={[tw`px-4 py-2 flex-row justify-between items-center`, { borderTopWidth: 1, borderColor: colors.border }]}>
                <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                  Optional
                </Text>
                <Text style={[tw`text-xs font-medium`, { color: comment.length > 400 ? colors.warning : colors.mutedForeground }]}>
                  {comment.length}/500
                </Text>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              tw`rounded-2xl p-4 flex-row items-center justify-center`,
              {
                backgroundColor: rating === 0 ? colors.muted : colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: rating === 0 ? 0 : 0.25,
                shadowRadius: 8,
                elevation: rating === 0 ? 0 : 4,
              }
            ]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <>
                <Send size={18} color={rating === 0 ? colors.mutedForeground : colors.primaryForeground} style={tw`mr-2`} />
                <Text style={[tw`font-bold text-base`, { color: rating === 0 ? colors.mutedForeground : colors.primaryForeground }]}>
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={tw`h-4`} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
