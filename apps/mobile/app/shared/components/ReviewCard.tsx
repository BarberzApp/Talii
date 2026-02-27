import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Star, MessageSquare, Calendar, Flag, CheckCircle, Pencil, Trash2 } from 'lucide-react-native';
import tw from 'twrnc';
import { Review } from '../types';
import { Avatar } from './ui';
import { ReportContentModal } from './ReportContentModal';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from './theme';

interface ReviewCardProps {
  review: Review;
  onPress?: () => void;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ 
  review, 
  onPress, 
  showActions = false, 
  onEdit, 
  onDelete 
}: ReviewCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const isOwnReview = user?.id === review.client_id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return (
      <View style={tw`flex-row items-center`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={18}
            fill={index < rating ? colors.premium : 'transparent'}
            color={index < rating ? colors.premium : colors.border}
            style={tw`mr-0.5`}
          />
        ))}
      </View>
    );
  };

  return (
    <>
    <TouchableOpacity
      style={[
        tw`rounded-2xl p-5 mb-4`,
        {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top row: badges */}
      {(review.is_verified || !isOwnReview) && (
        <View style={tw`flex-row items-center justify-between mb-3`}>
          {review.is_verified ? (
            <View style={[tw`flex-row items-center px-2.5 py-1 rounded-full`, { backgroundColor: colors.successSubtle }]}>
              <CheckCircle size={12} color={colors.success} />
              <Text style={[tw`text-xs font-semibold ml-1`, { color: colors.success }]}>Verified Booking</Text>
            </View>
          ) : (
            <View />
          )}
          {!isOwnReview && (
            <TouchableOpacity
              style={[tw`flex-row items-center px-2 py-1 rounded-full`, { backgroundColor: colors.muted }]}
              onPress={(e) => {
                e.stopPropagation();
                setShowReportModal(true);
              }}
            >
              <Flag size={11} color={colors.mutedForeground} />
              <Text style={[tw`text-xs ml-1`, { color: colors.mutedForeground }]}>Report</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Header: Avatar + Info */}
      <View style={tw`flex-row items-center`}>
        <View style={[
          tw`rounded-full overflow-hidden`,
          {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }
        ]}>
          <Avatar
            src={review.client?.avatar_url}
            size="sm"
          />
        </View>
        <View style={tw`flex-1 ml-3`}>
          <Text style={[tw`font-bold text-base`, { color: colors.foreground }]}>
            {review.client?.name || 'Anonymous'}
          </Text>
          <View style={tw`flex-row items-center mt-1`}>
            {renderStars(review.rating)}
            <View style={[tw`ml-2 px-1.5 py-0.5 rounded-md`, { backgroundColor: colors.primarySubtle }]}>
              <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                {review.rating}.0
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Meta row: date + service */}
      <View style={tw`flex-row items-center mt-3 flex-wrap`}>
        <View style={tw`flex-row items-center mr-4`}>
          <Calendar size={13} color={colors.mutedForeground} />
          <Text style={[tw`text-xs ml-1`, { color: colors.mutedForeground }]}>
            {formatDate(review.created_at)}
          </Text>
        </View>
        {review.booking?.service?.name && (
          <View style={[tw`flex-row items-center px-2 py-0.5 rounded-full`, { backgroundColor: colors.primarySubtle }]}>
            <Text style={[tw`text-xs font-medium`, { color: colors.primary }]}>
              {review.booking.service.name}
            </Text>
          </View>
        )}
      </View>

      {/* Review comment */}
      {review.comment && (
        <View style={[
          tw`mt-4 p-4 rounded-xl`,
          { backgroundColor: colors.surface }
        ]}>
          <Text style={[tw`text-sm leading-6`, { color: colors.foreground }]}>
            "{review.comment}"
          </Text>
        </View>
      )}

      {/* Actions */}
      {showActions && (onEdit || onDelete) && (
        <View style={[tw`flex-row justify-end mt-4 pt-3`, { borderTopWidth: 1, borderColor: colors.border }]}>
          {onEdit && (
            <TouchableOpacity
              style={[tw`flex-row items-center px-4 py-2 rounded-lg mr-2`, { backgroundColor: colors.primarySubtle }]}
              onPress={onEdit}
            >
              <Pencil size={14} color={colors.primary} />
              <Text style={[tw`text-xs font-semibold ml-1.5`, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[tw`flex-row items-center px-4 py-2 rounded-lg`, { backgroundColor: colors.destructiveSubtle }]}
              onPress={onDelete}
            >
              <Trash2 size={14} color={colors.destructive} />
              <Text style={[tw`text-xs font-semibold ml-1.5`, { color: colors.destructive }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
    
    <ReportContentModal
      visible={showReportModal}
      onClose={() => setShowReportModal(false)}
      contentType="review"
      contentId={review.id}
      reportedUserId={review.client_id}
      contentDescription={`Review by ${review.client?.name || 'Anonymous'}: ${review.comment?.substring(0, 100) || 'No comment'}...`}
    />
    </>
  );
}
