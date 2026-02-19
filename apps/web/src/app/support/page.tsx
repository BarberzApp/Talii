'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useToast } from '@/shared/components/ui/use-toast'
import { logger } from '@/shared/lib/logger'
import { 
  Mail, 
  MessageCircle, 
  HelpCircle, 
  Phone, 
  Clock,
  CheckCircle,
  Send
} from 'lucide-react'

// Add custom styles for gradient animation
const gradientAnimation = `
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
`

const faqData = [
  {
    question: "How do I book an appointment?",
    answer: "Simply browse our barbers, select your preferred time slot, and complete the booking process. You'll receive a confirmation via SMS and email."
  },
  {
    question: "Can I cancel or reschedule my appointment?",
    answer: "Yes! You can cancel or reschedule your appointment up to 2 hours before your scheduled time through your booking confirmation or profile page."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and digital payment methods through our secure payment system."
  },
  {
    question: "How do I become a barber on the platform?",
    answer: "Click on 'Become a Barber' in the main menu, complete the registration process, and our team will review your application within 24-48 hours."
  },
  {
    question: "Is my personal information secure?",
    answer: "Absolutely. We use industry-standard encryption and security measures to protect your personal and payment information."
  }
]

const supportCategories = [
  { value: 'booking', label: 'Booking Issues' },
  { value: 'payment', label: 'Payment Problems' },
  { value: 'account', label: 'Account Issues' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'feedback', label: 'Feedback' }
]

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }
      
      toast({
        title: "Message Sent!",
        description: "We've received your support request and will get back to you within 5 days.",
      })

      // Reset form
      setFormData({
        name: '',
        email: '',
        category: '',
        subject: '',
        message: ''
      })
    } catch (error) {
      logger.error('Support form error', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send your message. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gradientAnimation }} />
      <div className="min-h-screen bg-background">
        {/* Background Elements - matching landing page */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 relative z-10">
          {/* Header Section - matching landing page style */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="flex items-center justify-center mb-6">
              <div className="p-5 bg-primary/20 rounded-full shadow-lg flex items-center justify-center">
                <MessageCircle className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bebas font-bold text-foreground leading-tight mb-4">
              Support Center
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-6">
              We&apos;re here to help! Get in touch with our support team or browse our frequently asked questions.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center bg-muted backdrop-blur-sm rounded-xl px-4 py-2 border border-border">
                <Clock className="w-4 h-4 text-primary mr-2" />
                <span className="text-sm text-foreground font-medium">Response within 24 hours</span>
              </div>
            </div>
          </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact Form - matching landing page style */}
          <Card className="bg-card border border-border shadow-xl backdrop-blur-xl rounded-3xl p-6 sm:p-8">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                Contact Support
              </CardTitle>
              <CardDescription className="text-muted-foreground text-base">
                Send us a message and we&apos;ll get back to you within 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-foreground">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={( e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
                      placeholder="Your name"
                      required
                      className="h-12 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="h-12 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold text-foreground">Category</Label>
                  <Select value={formData.category} onValueChange={(value: string) => handleInputChange('category', value)}>
                    <SelectTrigger className="h-12 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-primary">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-xl backdrop-blur-sm">
                      {supportCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value} className="hover:bg-accent/50 focus:bg-accent/50">
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-semibold text-foreground">Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('subject', e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                    className="h-12 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-semibold text-foreground">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('message', e.target.value)}
                    placeholder="Please provide as much detail as possible..."
                    rows={6}
                    required
                    className="bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg font-semibold bg-secondary hover:bg-secondary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-3" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-3" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info & FAQ */}
          <div className="space-y-8">
            {/* Contact Information */}
            <Card className="bg-card border border-border shadow-xl backdrop-blur-xl rounded-3xl p-6 sm:p-8">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  Get in Touch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-xl border border-border">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Email Support</p>
                    <p className="text-muted-foreground">support@talii.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-xl border border-border">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Response Time</p>
                    <p className="text-muted-foreground">Within 24 hours</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-xl border border-border">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Availability</p>
                    <p className="text-muted-foreground">Monday - Friday, 9 AM - 6 PM</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FAQ Section */}
            <Card className="bg-card border border-border shadow-xl backdrop-blur-xl rounded-3xl p-6 sm:p-8">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <HelpCircle className="h-6 w-6 text-primary" />
                  </div>
                  Frequently Asked Questions
                </CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Quick answers to common questions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4">
                  {faqData.map((faq, index) => (
                    <div key={index} className="group p-6 bg-muted rounded-xl border border-border hover:border-primary/30 transition-all duration-300">
                      <h4 className="font-semibold text-lg mb-3 text-foreground group-hover:text-primary transition-colors">{faq.question}</h4>
                      <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
