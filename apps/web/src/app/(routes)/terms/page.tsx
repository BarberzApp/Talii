"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ChevronLeft, Shield, Scale, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Gradients - Matching Landing/Support Page */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[28rem] h-[28rem] rounded-full blur-3xl bg-primary/10 dark:bg-primary/8" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 rounded-full blur-3xl bg-secondary/8 dark:bg-secondary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl bg-primary/5 dark:bg-primary/3" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20 relative z-10">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="bg-card/50 backdrop-blur-xl border-border shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-8 border-b border-border/50">
            <CardTitle className="text-4xl sm:text-5xl font-bebas text-foreground mb-2 tracking-wide">
              Terms of Service
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Effective Date: July 7, 2025 • Last Updated: April 1, 2026
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 sm:p-12 space-y-12 text-foreground/90 leading-relaxed">
            
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-secondary mb-4">
                <Info className="w-6 h-6" />
                <h2 className="text-2xl font-bold font-bebas tracking-tight">Overview</h2>
              </div>
              <p>
                Welcome to <span className="font-bold text-foreground">Talii</span>. These Terms of Service ("Terms") govern your access to and use of the Talii website, mobile application, and all associated services (collectively, the "Services").
              </p>
              <p>
                By using our Services, you agree to be bound by these Terms, our Privacy Policy, and all applicable laws and regulations. If you do not agree, do not use the Services.
              </p>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-secondary mb-4">
                <Shield className="w-6 h-6" />
                <h2 className="text-2xl font-bold font-bebas tracking-tight">Our Services</h2>
              </div>
              <p>
                Talii is a digital marketplace that connects clients seeking beauty and barbering services ("Clients") with independent cosmetologists and barbers ("Professionals"). Talii provides the digital infrastructure for booking, service management, payment processing, and content discovery but does not directly offer any hair or beauty services.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6 mt-6">
                <div className="bg-muted/50 p-6 rounded-2xl border border-border">
                  <h3 className="font-bold text-foreground mb-2 text-lg uppercase tracking-tight font-bebas">For Clients</h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>Discover top-rated barbers via location-based search.</li>
                    <li>Book services instantly with real-time availability.</li>
                    <li>Securely pay for services via Stripe integration.</li>
                    <li>Manage booking history and leave reviews.</li>
                  </ul>
                </div>
                <div className="bg-muted/50 p-6 rounded-2xl border border-border">
                  <h3 className="font-bold text-foreground mb-2 text-lg uppercase tracking-tight font-bebas">For Professionals</h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>Create professional portfolios with images and videos.</li>
                    <li>Custom scheduling with conflict detection.</li>
                    <li>Detailed revenue tracking and business insights.</li>
                    <li>Access to over 100 specialty tags for discovery.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-secondary mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-2xl font-bold font-bebas tracking-tight">Safety & Liability</h2>
              </div>
              <div className="space-y-4 bg-orange-500/5 border border-orange-500/20 p-6 rounded-2xl">
                <p className="text-sm font-medium text-foreground uppercase tracking-widest text-center opacity-80 mb-2">Important Notice</p>
                <p>
                  Talii is not liable for any damages, losses, injuries, or claims arising out of the actions or omissions of any Professional or Client. We do not verify the licensing status of Professionals. Clients are solely responsible for ensuring that their selected Professional holds any licenses required by law.
                </p>
                <p>
                  By using Talii, you acknowledge that private appointments carry inherent risks and you are solely responsible for your safety and actions.
                </p>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 text-secondary mb-4">
                <Scale className="w-6 h-6" />
                <h2 className="text-2xl font-bold font-bebas tracking-tight">Governing Law</h2>
              </div>
              <p>
                These Terms are governed by the laws of the <span className="font-semibold">State of New Jersey</span>, without regard to its conflict of law rules. Any disputes must be resolved in the courts of New Jersey or through binding arbitration if mutually agreed.
              </p>
            </section>

            <section className="space-y-6 border-t border-border pt-10">
              <h2 className="text-2xl font-bold text-foreground">CONTACT US</h2>
              <p>
                For questions or concerns regarding these Terms, please contact us at:
              </p>
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 inline-block">
                <p className="font-bold text-lg text-primary">Email: support@talii.com</p>
              </div>
            </section>
          </CardContent>
          
          <div className="bg-muted/30 p-8 text-center border-t border-border/50">
            <div className="flex justify-center gap-4 text-sm font-semibold">
              <Link href="/privacy" className="text-secondary hover:underline">
                Privacy Policy
              </Link>
              <span className="text-border">|</span>
              <Link href="/support" className="text-secondary hover:underline">
                Support Center
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              © 2026 Talii. All rights reserved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
 