import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { OwnReview, PublicReview, RatingStats } from '@barber-app/shared';
import { api, errorMessage } from '../lib/api';
import { logger } from '../lib/logger';

/**
 * A barber's public reviews (GET /api/barbers/:id/reviews) and the caller's own
 * review actions (POST/PATCH/DELETE /api/reviews). A review needs a completed
 * booking; there is one review per booking.
 */
export function useReviews(barberId?: string) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.barbers.reviews(id, { limit: 50 });
      setReviews(res.reviews);
      setStats(res.rating);
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      Alert.alert('Error', errorMessage(error, 'Failed to load reviews.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const submitReview = useCallback(
    async (input: { bookingId: string; rating: number; comment?: string }): Promise<OwnReview> => {
      try {
        setSubmitting(true);
        const { review } = await api.reviews.create({
          bookingId: input.bookingId,
          rating: input.rating,
          comment: input.comment || null,
        });
        if (barberId) await fetchReviews(barberId);
        Alert.alert('Success', 'Review submitted successfully!');
        return review;
      } catch (error) {
        logger.error('Error submitting review:', error);
        Alert.alert('Error', errorMessage(error, 'Failed to submit review. Please try again.'));
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [barberId, fetchReviews]
  );

  const updateReview = useCallback(
    async (reviewId: string, updates: { rating?: number; comment?: string | null }): Promise<OwnReview> => {
      try {
        setSubmitting(true);
        const { review } = await api.reviews.update(reviewId, updates);
        if (barberId) await fetchReviews(barberId);
        Alert.alert('Success', 'Review updated successfully!');
        return review;
      } catch (error) {
        logger.error('Error updating review:', error);
        Alert.alert('Error', errorMessage(error, 'Failed to update review. Please try again.'));
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [barberId, fetchReviews]
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      try {
        setSubmitting(true);
        await api.reviews.remove(reviewId);
        if (barberId) await fetchReviews(barberId);
        Alert.alert('Success', 'Review deleted successfully!');
      } catch (error) {
        logger.error('Error deleting review:', error);
        Alert.alert('Error', errorMessage(error, 'Failed to delete review. Please try again.'));
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [barberId, fetchReviews]
  );

  useEffect(() => {
    if (barberId) fetchReviews(barberId);
  }, [barberId, fetchReviews]);

  return {
    reviews,
    stats,
    loading,
    submitting,
    fetchReviews,
    submitReview,
    updateReview,
    deleteReview,
  };
}
