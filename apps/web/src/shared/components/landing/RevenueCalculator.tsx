"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { NumberTicker } from "@/shared/components/ui/magic/number-ticker";
import { cn } from "@/shared/lib/utils";
import { LandingSection } from "./LandingSection";

const formatInteger = (n: number) =>
  Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

export interface RevenueCalculatorProps {
  /** Default monthly revenue value */
  defaultMonthlyRevenue?: number;
  /** Default cut cost */
  defaultCutCost?: number;
  /** Callback when calculation changes */
  onCalculate?: (result: {
    monthlyRevenue: number;
    cutCost: number;
    numberOfCuts: number;
    platformFeeBonus: number;
    extraAnnual: number;
  }) => void;
  /** Callback when CTA is clicked */
  onCtaClick?: () => void;
  /** CTA button label */
  ctaLabel?: string;
  /** CTA button href */
  ctaHref?: string;
  /** Section title */
  title?: string;
  /** Section subtitle */
  subtitle?: string;
  /** Additional className */
  className?: string;
}

export function RevenueCalculator({
  defaultMonthlyRevenue = 5000,
  defaultCutCost = 50,
  onCalculate,
  onCtaClick,
  ctaLabel = "Start Earning More Today",
  ctaHref,
  title = 'The "Holy Sh*t" Moment',
  subtitle = "See exactly how much more you could be earning with Talii's revenue optimization tools.",
  className,
}: RevenueCalculatorProps) {
  const [averageMonthlyAmount, setAverageMonthlyAmount] = useState(
    defaultMonthlyRevenue.toString()
  );
  const [cutCost, setCutCost] = useState(defaultCutCost.toString());
  const [numberOfCuts, setNumberOfCuts] = useState(0);
  const [platformFeeBonus, setPlatformFeeBonus] = useState(0);
  const [extraAnnual, setExtraAnnual] = useState(0);

  const updateCalculator = () => {
    const monthlyAmount = parseFloat(averageMonthlyAmount) || 0;
    const servicePrice = parseFloat(cutCost) || 0;
    const cuts = servicePrice > 0 ? Math.round(monthlyAmount / servicePrice) : 0;
    // Barber gets $1.20 per booking (40% of $3.00 after Stripe fee)
    const bonus = cuts * 1.2;
    const annual = bonus * 12;

    setNumberOfCuts(cuts);
    setPlatformFeeBonus(bonus);
    setExtraAnnual(annual);

    if (onCalculate) {
      onCalculate({
        monthlyRevenue: monthlyAmount,
        cutCost: servicePrice,
        numberOfCuts: cuts,
        platformFeeBonus: bonus,
        extraAnnual: annual,
      });
    }
  };

  useEffect(() => {
    updateCalculator();
  }, [averageMonthlyAmount, cutCost]);

  const handleInputChange = (
    value: string,
    setter: (val: string) => void
  ) => {
    const numericValue = value.replace(/[^\d]/g, "");
    setter(numericValue);
  };

  return (
    <LandingSection id="calculator" maxWidth="4xl" className={cn("bg-background", className)}>
      {(title || subtitle) && (
          <div className="text-center mb-[var(--landing-block-mb-compact)] sm:mb-[var(--landing-block-mb-compact-sm)]">
            {title && (
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bebas font-bold text-foreground mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <Card className="bg-surface border border-border shadow-xl dark:shadow-2xl rounded-3xl p-6 sm:p-8 lg:p-12">
          <CardContent className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-start">
            {/* Calculator Input */}
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-foreground font-semibold mb-2 text-sm sm:text-base">
                    Average Monthly Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      type="text"
                      value={averageMonthlyAmount}
                      onChange={(e) =>
                        handleInputChange(e.target.value, setAverageMonthlyAmount)
                      }
                      className="w-full pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 bg-muted border border-border rounded-xl text-foreground text-lg sm:text-xl font-semibold placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
                      placeholder={defaultMonthlyRevenue.toString()}
                      aria-label="Average monthly revenue"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-2 text-sm sm:text-base">
                    Cut Cost
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      type="text"
                      value={cutCost}
                      onChange={(e) =>
                        handleInputChange(e.target.value, setCutCost)
                      }
                      className="w-full pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 bg-muted border border-border rounded-xl text-foreground text-lg sm:text-xl font-semibold placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
                      placeholder={defaultCutCost.toString()}
                      aria-label="Cost per cut"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 text-center">
                <div className="text-base sm:text-lg text-muted-foreground mb-2">
                  You do{" "}
                  <span className="font-bold text-secondary">
                    <NumberTicker
                      value={numberOfCuts}
                      formatValue={formatInteger}
                    />
                  </span>{" "}
                  cuts per month
                </div>
                <div className="text-xl sm:text-2xl font-bold text-secondary mb-2">
                  Platform Fee Bonus: $
                  <NumberTicker
                    value={platformFeeBonus}
                    formatValue={formatInteger}
                  />
                  /month
                </div>
                <div className="text-base sm:text-lg text-muted-foreground mb-4">
                  That's{" "}
                  <span className="font-bold text-secondary">
                    $
                    <NumberTicker
                      value={extraAnnual}
                      formatValue={formatInteger}
                    />
                  </span>{" "}
                  per year in extra income!
                </div>
                <div className="bg-secondary/10 dark:bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/20 dark:border-secondary/30 inline-block mt-4">
                  <div className="text-muted-foreground text-xs sm:text-sm mb-1">
                    Breakdown:
                  </div>
                  <div className="text-foreground text-sm sm:text-base font-semibold">
                    <NumberTicker value={numberOfCuts} formatValue={formatInteger} /> cuts × $1.20 ={" "}
                    <span className="text-secondary">
                      $
                      <NumberTicker
                        value={platformFeeBonus}
                        formatValue={formatInteger}
                      />
                    </span>{" "}
                    per month
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-secondary/10 dark:bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/20 dark:border-secondary/30">
                <p className="text-secondary text-xs sm:text-sm font-medium mb-2">
                  Total Monthly Revenue
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-secondary">
                  $
                  <NumberTicker
                    value={platformFeeBonus}
                    formatValue={formatInteger}
                  />
                </p>
                <p className="text-secondary/80 text-xs sm:text-sm mt-1">
                  Service + Platform Fees (40%)
                </p>
              </div>

              <div className="bg-muted rounded-2xl p-4 sm:p-6">
                <p className="text-muted-foreground text-xs sm:text-sm mb-2">
                  Extra Annual Income
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">
                  $
                  <NumberTicker
                    value={extraAnnual}
                    formatValue={formatInteger}
                  />
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                  From platform fees alone
                </p>
              </div>

              <div className="bg-secondary/10 dark:bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/20 dark:border-secondary/30">
                <p className="text-secondary text-xs sm:text-sm font-medium mb-2">
                  Monthly Breakdown
                </p>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Number of Cuts:</span>
                    <span className="text-foreground">
                      <NumberTicker value={numberOfCuts} formatValue={formatInteger} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee Bonus:</span>
                    <span className="text-foreground">
                      $
                      <NumberTicker
                        value={platformFeeBonus}
                        formatValue={formatInteger}
                      />
                    </span>
                  </div>
                </div>
              </div>

              {(ctaHref || onCtaClick) && (
                <Button
                  href={ctaHref}
                  onClick={onCtaClick}
                  className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-secondary text-primary-foreground rounded-xl font-semibold text-base sm:text-lg hover:bg-secondary/90 transition-colors"
                >
                  {ctaLabel}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
    </LandingSection>
  );
}
