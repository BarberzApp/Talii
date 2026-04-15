"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Gradients - Matching Landing/Support Page */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full blur-3xl bg-primary/10 dark:bg-primary/8" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 rounded-full blur-3xl bg-secondary/8 dark:bg-secondary/5" />
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
              Privacy Policy
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Effective Date: December 2025 • Last Updated: December 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 sm:p-12 space-y-10 text-foreground/90 leading-relaxed">
            <section className="space-y-4">
              <p>
                Welcome to Talii. We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application, website, and related services (collectively, the "Services").
              </p>
              <p>
                By using our Services, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, do not use our Services.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">1. INFORMATION WE COLLECT</h2>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-secondary">1.1 Information You Provide to Us</h3>
                <div className="pl-4 border-l-2 border-secondary/30 space-y-4">
                  <div>
                    <h4 className="font-bold mb-1">Account Registration:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Name and email address</li>
                      <li>Phone number</li>
                      <li>Password (encrypted and stored securely)</li>
                      <li>User role (client or barber/professional)</li>
                      <li>Business name (for barbers/professionals)</li>
                      <li>Username and profile information</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Profile Information:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Profile photo and cover photo</li>
                      <li>Bio and description</li>
                      <li>Location and address information</li>
                      <li>Social media links (Instagram, Twitter, TikTok, Facebook)</li>
                      <li>Business information (for barbers)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Booking Information:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Service preferences</li>
                      <li>Booking history</li>
                      <li>Payment information (processed securely through Stripe)</li>
                      <li>Notes and special requests for appointments</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-secondary">1.2 Information Automatically Collected</h3>
                <div className="pl-4 border-l-2 border-secondary/30 space-y-2 text-muted-foreground">
                  <p><span className="font-bold text-foreground">Device Information:</span> Device type, model, OS, unique identifiers, and network information.</p>
                  <p><span className="font-bold text-foreground">Location Information:</span> Precise location data (with permission) and approximate location based on IP address.</p>
                  <p><span className="font-bold text-foreground">Usage Information:</span> Features accessed, content interactions, search queries, and booking patterns.</p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">2. HOW WE USE YOUR INFORMATION</h2>
              <ul className="grid sm:grid-cols-2 gap-4">
                <li className="bg-muted/50 p-4 rounded-2xl border border-border">
                  <h4 className="font-bold mb-2">Service Delivery</h4>
                  <p className="text-sm text-muted-foreground">Facilitating bookings, processing payments, and connecting clients with professionals.</p>
                </li>
                <li className="bg-muted/50 p-4 rounded-2xl border border-border">
                  <h4 className="font-bold mb-2">Communication</h4>
                  <p className="text-sm text-muted-foreground">Sending reminders, confirmations, and responding to support inquiries.</p>
                </li>
                <li className="bg-muted/50 p-4 rounded-2xl border border-border">
                  <h4 className="font-bold mb-2">Personalization</h4>
                  <p className="text-sm text-muted-foreground">Showing relevant barbers and recommending services based on your preferences.</p>
                </li>
                <li className="bg-muted/50 p-4 rounded-2xl border border-border">
                  <h4 className="font-bold mb-2">Safety & Security</h4>
                  <p className="text-sm text-muted-foreground">Detecting fraud, verifying identities, and enforcing our terms.</p>
                </li>
              </ul>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">3. HOW WE SHARE YOUR INFORMATION</h2>
              <p>
                We share information with <span className="font-semibold text-secondary">Barbers/Professionals</span> when you book a service, and with trusted <span className="font-semibold text-secondary">Service Providers</span> like Stripe (payments), Supabase (database), and Sentry (error tracking). We may also share data if required by law or with your explicit consent.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">4. DATA SECURITY & ACCOUNT DELETION</h2>
              <div className="space-y-4">
                <p>
                  We use industry-standard encryption and secure payment processing through Stripe. We retain your information as long as necessary to provide Services, comply with legal obligations, or until you delete your account.
                </p>
                <div className="bg-muted/50 p-6 rounded-2xl border border-secondary/20">
                  <h3 className="font-bold text-foreground mb-2 text-lg">Account Deletion</h3>
                  <p className="text-sm text-foreground/90">
                    If you created an account inside our mobile application, you have the right to request the complete deletion of your account and associated personal data. 
                  </p>
                  <ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-muted-foreground">
                    <li><strong>In-App Deletion:</strong> You can delete your account by logging into the Talii app and navigating to Settings &gt; Delete Account.</li>
                    <li><strong>Email Request:</strong> Alternatively, you can email us at support@talii.com with the subject "Account Deletion Request".</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-3">
                    Upon initiating deletion, we will promptly remove your profile, bookings, and uploaded photos from our active databases, except where we are legally required to retain certain transactional records.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6 border-t border-border pt-10">
              <h2 className="text-2xl font-bold text-foreground">CONTACT US</h2>
              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 inline-block">
                <p className="font-bold text-lg text-primary">Email: support@talii.com</p>
              </div>
            </section>
          </CardContent>
          <div className="bg-muted/30 p-8 text-center border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4">
              By using our Services, you consent to the collection and use of your information as described in this Privacy Policy.
            </p>
            <div className="flex justify-center gap-4 text-sm font-semibold">
              <Link href="/terms" className="text-secondary hover:underline">
                Terms of Service
              </Link>
              <span className="text-border">|</span>
              <Link href="/support" className="text-secondary hover:underline">
                Support Center
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


