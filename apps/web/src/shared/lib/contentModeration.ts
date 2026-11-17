// Content Moderation Service
// This service provides multiple layers of content moderation
import { logger } from './logger';

export interface ContentValidation {
  isValid: boolean;
  issues: string[];
  suggestions?: string[];
}

// Explicit content keywords (expandable list)
const EXPLICIT_KEYWORDS = [
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
  'nigger', 'faggot', 'retard', 'idiot', 'stupid', 'dumb', 'moron', 'bastard',
  'motherfucker', 'fucker', 'shitty', 'fucking', 'damn', 'hell'
];

// Spam patterns
const SPAM_PATTERNS = [
  /\b[A-Z]{3,}\b/g, // ALL CAPS
  /!{3,}/g, // Multiple exclamation marks
  /\?{3,}/g, // Multiple question marks
  /\.{3,}/g, // Multiple dots
  /\*{3,}/g, // Multiple asterisks
];

// Aggressive language patterns
const AGGRESSIVE_WORDS = [
  'hate', 'terrible', 'awful', 'worst', 'horrible', 'disgusting', 'useless',
  'worthless', 'pathetic', 'ridiculous', 'stupid', 'idiot', 'moron'
];

// Client-side content validation
export function validateContent(text: string): ContentValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check length
  if (text.length < 10) {
    issues.push('Review must be at least 10 characters long');
    suggestions.push('Please provide more details about your experience');
  }
  if (text.length > 500) {
    issues.push('Review must be less than 500 characters');
    suggestions.push('Please keep your review concise');
  }

  // Check for explicit keywords
  const lowerText = text.toLowerCase();
  const foundExplicit = EXPLICIT_KEYWORDS.filter(word => lowerText.includes(word));
  if (foundExplicit.length > 0) {
    issues.push(`Contains inappropriate language`);
    suggestions.push('Please use respectful language in your review');
  }

  // Check for spam patterns
  const spamFound = SPAM_PATTERNS.some(pattern => pattern.test(text));
  if (spamFound) {
    issues.push('Contains spam-like patterns (excessive caps, punctuation)');
    suggestions.push('Please write your review in a natural, respectful tone');
  }

  // Check for repetitive characters
  if (/(.)\1{4,}/.test(text)) {
    issues.push('Contains too many repetitive characters');
    suggestions.push('Please avoid excessive repetition');
  }

  // Check for aggressive language
  const aggressiveCount = AGGRESSIVE_WORDS.filter(word => lowerText.includes(word)).length;
  if (aggressiveCount > 2) {
    issues.push('Contains overly negative language');
    suggestions.push('Please provide constructive feedback');
  }

  // Check for minimum meaningful content
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length < 3) {
    issues.push('Review is too short');
    suggestions.push('Please provide more details about your experience');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

// Real-time moderation for UI feedback
export function getModerationStatus(text: string): 'clean' | 'flagged' | 'checking' {
  if (!text || text.length === 0) return 'clean';
  
  const validation = validateContent(text);
  return validation.isValid ? 'clean' : 'flagged';
}

// Content sanitization (removes or replaces inappropriate content)
export function sanitizeContent(text: string): string {
  let sanitized = text;
  
  // Replace explicit words with asterisks
  EXPLICIT_KEYWORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '*'.repeat(word.length));
  });
  
  // Remove excessive punctuation
  sanitized = sanitized.replace(/!{3,}/g, '!');
  sanitized = sanitized.replace(/\?{3,}/g, '?');
  sanitized = sanitized.replace(/\.{3,}/g, '...');
  
  // Remove excessive caps
  sanitized = sanitized.replace(/\b[A-Z]{3,}\b/g, (match) => match.toLowerCase());
  
  return sanitized;
} 