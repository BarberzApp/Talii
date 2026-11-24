import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { StarRating } from "@/shared/components/ui/StarRating";
import {
  CheckCircle,
  XCircle,
  Edit, Loader2, Shield
} from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { api, errorMessage } from "@/shared/lib/api";
import { sanitizeContent } from "@barber-app/shared";
import { logger } from "@/shared/lib/logger";

interface Review {
  id: string;
  rating: number;
  comment: string;
  is_public: boolean;
  created_at: string;
  client: {
    name: string;
    avatar_url?: string;
  };
  barber: {
    name: string;
    avatar_url?: string;
  };
}

export function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [editingComment, setEditingComment] = useState("");
  const { toast } = useToast();

  /**
   * GET /api/admin/reviews. Reviews are public as soon as they pass the word
   * filter; moderation is hiding or restoring them (PATCH /api/admin/reviews/:id).
   */
  const fetchPendingReviews = useCallback(async () => {
    try {
      setLoading(true);
      const { reviews: rows } = await api.admin.listReviews({ limit: 100 });
      setReviews(
        rows.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment ?? '',
          is_public: !r.is_hidden,
          created_at: r.created_at,
          client: { name: r.reviewer_username ?? 'Deleted user' },
          barber: { name: r.barber_business_name ?? 'Barber' },
        }))
      );
    } catch (error) {
      logger.error('Error fetching reviews', error);
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to load reviews"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  const setHidden = async (reviewId: string, hidden: boolean) => {
    try {
      await api.admin.setReviewHidden(reviewId, hidden);
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, is_public: !hidden } : r)));
      toast({
        title: hidden ? "Review Hidden" : "Review Visible",
        description: hidden ? "The review is no longer public" : "The review is public",
      });
    } catch (error) {
      logger.error('Error updating review visibility', error);
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to update review"),
        variant: "destructive",
      });
    }
  };

  const approveReview = (reviewId: string) => setHidden(reviewId, false);
  const rejectReview = (reviewId: string) => setHidden(reviewId, true);

  /** The API cannot rewrite a client's words; hide the review instead. */
  const editReview = async (reviewId: string, _newComment: string) => {
    toast({
      title: "Editing not supported",
      description: "Reviews cannot be edited by admins. The review was hidden instead.",
    });
    await setHidden(reviewId, true);
    setSelectedReview(null);
    setEditingComment("");
  };

  const sanitizeAndEdit = async (reviewId: string) => {
    const sanitized = sanitizeContent(editingComment);
    await editReview(reviewId, sanitized);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading pending reviews...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Review Moderation</h2>
          <p className="text-white/60">Manage and moderate user reviews</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {reviews.filter((r) => r.is_public).length} visible / {reviews.length} reviews
        </Badge>
      </div>

      {reviews.length === 0 ? (
        <Card className="bg-white/5 border border-white/10">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">All Caught Up!</h3>
            <p className="text-white/60">No pending reviews to moderate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="bg-white/5 border border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.client.avatar_url} alt={review.client.name} />
                      <AvatarFallback className="bg-secondary text-primary">
                        {review.client.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-white font-semibold">{review.client.name}</h4>
                      <p className="text-white/60 text-sm">Review for {review.barber.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size={16} />
                    <span className="text-white/60 text-sm">{review.rating}/5</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <p className="text-white">{review.comment}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {new Date(review.created_at).toLocaleDateString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {review.comment.length} characters
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveReview(review.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReview(review);
                        setEditingComment(review.comment);
                      }}
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectReview(review.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-black/95 border border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Edit Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={editingComment}
                onChange={(e) => setEditingComment(e.target.value)}
                className="w-full h-32 p-3 bg-white/5 border border-white/10 rounded-lg text-white resize-none"
                placeholder="Edit the review content..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => sanitizeAndEdit(selectedReview.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Sanitize & Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedReview(null);
                    setEditingComment("");
                  }}
                  className="border-white/20 text-white"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 