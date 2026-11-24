import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Edit3 } from "lucide-react";
import { WriteReviewModal } from "./WriteReviewModal";

interface PastStylistCardProps {
  barber: {
    id: string;
    name: string;
    image?: string;
    username?: string;
  };
  /** Formatted date of the last visit, e.g. "Nov 11, 2026". */
  lastVisit?: string;
  /** A completed appointment with this barber has no review yet. */
  canReview?: boolean;
  onReviewed?: () => void;
}

export function PastStylistCard({ barber, lastVisit, canReview = false, onReviewed }: PastStylistCardProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const handleBookAgain = () => {
    window.location.href = barber.username ? `/book/${barber.username}` : '/browse';
  };

  const handleWriteReview = () => {
    setIsReviewModalOpen(true);
  };

  return (
    <>
      <div className="group relative p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl hover:border-secondary/30 hover:shadow-2xl hover:shadow-secondary/10 transition-all duration-500 overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary/5 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative">
            <div className="absolute inset-0 bg-secondary/20 rounded-full blur-md scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Avatar className="h-24 w-24 sm:h-20 sm:w-20 ring-4 ring-background border border-white/10 group-hover:ring-secondary/20 transition-all duration-500 relative z-10">
              <AvatarImage src={barber.image} alt={barber.name} className="object-cover" />
              <AvatarFallback className="bg-secondary text-primary-foreground font-bebas text-3xl">
                {barber.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Barber Info */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bebas font-bold text-foreground text-3xl sm:text-2xl tracking-wide mb-1 group-hover:text-secondary transition-colors">
                  {barber.name}
                </h3>
                <p className="text-muted-foreground text-xs font-medium">
                  {lastVisit ? `Last visit ${lastVisit}` : 'Previous stylist'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button 
                  size="default" 
                  className="bg-button text-button-foreground font-bold hover:bg-button/90 px-6 h-11 rounded-xl shadow-lg transition-all active:scale-95"
                  onClick={handleBookAgain}
                >
                  Book Again
                </Button>
                {canReview && (
                  <Button 
                    variant="outline" 
                    className="h-11 rounded-xl transition-all"
                    onClick={handleWriteReview}
                  >
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Write a review
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <WriteReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        barber={barber}
        onReviewed={onReviewed}
      />
    </>
  );
} 