"use client";

import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export interface TestimonialCardProps {
  /** Testimonial author name */
  name: string;
  /** Author role/title */
  role: string;
  /** Author location */
  location: string;
  /** Testimonial quote */
  quote: string;
  /** Star rating (1-5) */
  rating: number;
  /** Optional metric to display (e.g., "+300% Revenue Growth") */
  metric?: string;
  /** Optional revenue/achievement text */
  revenue?: string;
  /** Optional avatar image URL */
  image?: string;
  /** Additional className */
  className?: string;
}

export function TestimonialCard({
  name,
  role,
  location,
  quote,
  rating,
  metric,
  revenue,
  image,
  className,
}: TestimonialCardProps) {
  return (
    <Card
      className={cn(
        "bg-surface border border-border shadow-lg dark:shadow-xl rounded-2xl p-6 sm:p-8 hover:shadow-xl dark:hover:shadow-2xl hover:-translate-y-1 transition-all duration-300",
        className
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-start gap-4 mb-6">
          <div
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-semibold text-secondary",
              "bg-secondary/15 border border-secondary/25 dark:bg-secondary/20 dark:border-secondary/30"
            )}
            aria-hidden
          >
            {image && !image.includes("placeholder") ? (
              <img
                src={image}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              getInitial(name)
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{name}</h3>
            <p className="text-muted-foreground text-sm">
              {role} • {location}
            </p>
            {(revenue || metric) && (
              <div className="flex items-center gap-2 mt-1">
                {revenue && (
                  <span className="text-secondary font-semibold">{revenue}</span>
                )}
                {metric && (
                  <span className="text-secondary/80 text-xs">{metric}</span>
                )}
                <div className="flex items-center">
                  {[...Array(rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 text-secondary fill-current"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <blockquote className="text-muted-foreground text-base leading-relaxed italic" cite={`${name}, ${role}`}>
          "{quote}"
        </blockquote>
      </CardContent>
    </Card>
  );
}
