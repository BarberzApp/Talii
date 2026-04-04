import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { StarRating } from "@/shared/components/ui/StarRating";
import { MessageSquare, Loader2, AlertTriangle, Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAuth } from "@/shared/hooks/use-auth-zustand";
import { supabase } from "@/shared/lib/supabase";
import { validateContent, moderateContentWithAI, getModerationStatus } from "@/shared/lib/contentModeration";
import { logger } from "@/shared/lib/logger";

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  barber: {
    id: string;
    name: string;
    image?: string;
  };
}

export function WriteReviewModal({ isOpen, onClose, barber }: WriteReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<'clean' | 'flagged' | 'checking'>('clean');
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isContentValid, setIsContentValid] = useState(false);
  const [debouncedText, setDebouncedText] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Debounced content validation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(reviewText);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [reviewText]);

  // Content validation effect
  useEffect(() => {
    if (debouncedText.length > 0) {
      const validation = validateContent(debouncedText);
      setValidationIssues(validation.issues);
      setIsContentValid(validation.isValid);
      setModerationStatus(getModerationStatus(debouncedText));
    } else {
      setValidationIssues([]);
      setIsContentValid(false);
      setModerationStatus('clean');
    }
  }, [debouncedText]);

  const handleSubmit = async () => {
    if (!rating || !reviewText.trim() || !user || !isContentValid) return;
    
    setIsSubmitting(true);
    setModerationStatus('checking');
    
    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('You must be logged in to submit a review');
      }

      logger.debug('User session', { userId: session.user.id, email: session.user.email });

      // Final validation check
      const validation = validateContent(reviewText);
      if (!validation.isValid) {
        throw new Error(`Content validation failed: ${validation.issues.join(', ')}`);
      }

      // AI moderation
      const moderation = await moderateContentWithAI(reviewText);
      if (!moderation.isAppropriate) {
        setModerationStatus('flagged');
        throw new Error(`Content flagged as inappropriate: ${moderation.flags.join(', ')}`);
      }

      setModerationStatus('clean');

      logger.debug('Checking for completed booking', { userId: user.id, barberId: barber.id });

      // First, find the most recent completed booking between this client and barber
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, barber_id, status')
        .eq('client_id', user.id)
        .eq('barber_id', barber.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      logger.debug('Completed booking query result', { booking, bookingError });

      if (bookingError || !booking) {
        logger.debug('No completed booking found, checking for any booking');
        
        // Check if there are any bookings with this barber at all
        const { data: anyBooking, error: anyBookingError } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('client_id', user.id)
          .eq('barber_id', barber.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        logger.debug('Any booking query result', { anyBooking, anyBookingError });

        if (anyBookingError || !anyBooking) {
          throw new Error('You haven\'t booked any appointments with this barber yet. You can only review barbers you\'ve had appointments with.');
        } else {
          throw new Error(`You have a ${anyBooking.status} appointment with this barber, but you can only review completed appointments. Please wait until your appointment is completed.`);
        }
      }

      // Check if a review already exists for this booking
      const { data: existingReview, error: existingError } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', booking.id)
        .single();

      if (existingReview) {
        throw new Error('You have already reviewed this appointment');
      }

      // Save the review to the database
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          barber_id: barber.id,
          client_id: user.id,
          rating: rating,
          comment: reviewText.trim(),
          is_verified: true, // Since it's from a verified booking
          is_public: true,
          is_moderated: moderation.isAppropriate // Use AI moderation result
        });

      if (reviewError) {
        throw reviewError;
      }

      // Note: Barber stats are automatically updated by the database trigger

      toast({
        title: "Review submitted!",
        description: `Your review for ${barber.name} has been submitted successfully.`,
      });
      
      onClose();
      // Reset form
      setRating(0);
      setReviewText("");
      setModerationStatus('clean');
    } catch (error) {
      logger.error('Error submitting review', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
    // Reset form
    setRating(0);
    setReviewText("");
    setModerationStatus('clean');
    setValidationIssues([]);
    setIsContentValid(false);
    setDebouncedText("");
  };

  // Real-time content validation
  const handleReviewTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setReviewText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full bg-background/80 border border-white/10 backdrop-blur-[40px] rounded-[2.5rem] shadow-2xl p-0 overflow-hidden outline-none">
        <div className="p-8 sm:p-12">
          <DialogHeader className="mb-10 p-0 text-left">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-secondary/10 rounded-2xl flex-shrink-0">
                <MessageSquare className="w-8 h-8 text-secondary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-4xl sm:text-5xl font-bebas font-bold text-foreground tracking-tight mb-2 leading-none">
                  Share Your <span className="text-secondary">Experience</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-base font-medium">
                  Your feedback helps the Talii community find the best talent.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Barber Info Card */}
            <div className="flex items-center gap-5 p-6 bg-white/5 rounded-3xl border border-white/5 group hover:border-secondary/20 transition-all duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-secondary/20 rounded-full blur-xl scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Avatar className="h-16 w-16 border-2 border-background ring-2 ring-white/5 relative z-10 transition-transform group-hover:scale-105">
                  <AvatarImage src={barber.image} alt={barber.name} className="object-cover" />
                  <AvatarFallback className="bg-secondary text-primary-foreground font-bebas text-2xl">
                    {barber.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <h3 className="font-bebas text-2xl font-bold text-foreground mb-0.5 tracking-wide group-hover:text-secondary transition-colors">
                  {barber.name}
                </h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                  Recent Stylist
                </p>
              </div>
            </div>
            
            {/* Rating Section */}
            <div className="space-y-4">
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-1">Overall Rating</label>
              <div className="flex items-center gap-4 bg-black/20 backdrop-blur-md p-6 rounded-3xl border border-white/5 w-fit">
                <StarRating 
                  rating={rating} 
                  size={36} 
                  interactive={true} 
                  onRatingChange={setRating}
                />
                <span className="text-2xl font-bebas text-secondary font-bold ml-2">
                  {rating > 0 ? `${rating}.0` : '--'}
                </span>
              </div>
            </div>
            
            {/* Review Content */}
            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Your Thoughts</label>
                <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  reviewText.length > 450 ? 'text-red-500' : 'text-muted-foreground/40'
                }`}>
                  {reviewText.length} / 500
                </span>
              </div>
              
              <div className="relative">
                <textarea
                  placeholder="Tell us about the service, the vibe, and the final look..."
                  className={`w-full h-40 px-6 py-5 bg-white/5 border rounded-[1.5rem] text-foreground placeholder:text-muted-foreground/30 focus:outline-none resize-none transition-all duration-300 leading-relaxed ${
                    isContentValid && reviewText.length > 0
                      ? 'border-green-500/30 focus:border-green-500/50'
                      : validationIssues.length > 0
                      ? 'border-red-500/30 focus:border-red-500/50'
                      : 'border-white/10 focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 ring-0'
                  }`}
                  value={reviewText}
                  onChange={handleReviewTextChange}
                  maxLength={500}
                />
                
                {/* Moderation Badges */}
                <div className="mt-3 min-h-[24px]">
                  {reviewText.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {isContentValid && moderationStatus === 'clean' && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                          <CheckCircle className="w-3 h-3" />
                          Content Approved
                        </div>
                      )}
                      {!isContentValid && validationIssues.length > 0 && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
                          <XCircle className="w-3 h-3" />
                          Invalid Content
                        </div>
                      )}
                      {moderationStatus === 'flagged' && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-yellow-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Safety Flag
                        </div>
                      )}
                      {moderationStatus === 'checking' && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-bold uppercase tracking-wider border border-secondary/20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Analyzing...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-12 pt-8 border-t border-white/5">
            <Button
              className="flex-[2] bg-secondary hover:bg-secondary/90 text-primary-foreground font-bold h-16 rounded-2xl shadow-xl shadow-secondary/10 transition-all active:scale-95 disabled:opacity-30"
              onClick={handleSubmit}
              disabled={!rating || !reviewText.trim() || isSubmitting || moderationStatus === 'flagged' || !isContentValid}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting Review...</span>
                </div>
              ) : (
                'Publish Review'
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground h-16 rounded-2xl transition-all"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 