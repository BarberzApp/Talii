/**
 * Local word filter for user-written text (reviews). Pure functions, no I/O:
 * the web app, the mobile app and the API all use the same rules.
 *
 * - `containsExplicitLanguage` is the server's gate (POST/PATCH /api/reviews).
 * - `validateContent` / `getModerationStatus` add stricter UI-only hints
 *   (length, shouting, repetition, tone) for the review form.
 * - `sanitizeContent` masks listed words for display or admin editing.
 *
 * Words are matched as whole words (with common suffixes such as "s", "ed",
 * "ing"), so "class" or "hello" are not flagged.
 */

export interface ContentValidation {
  isValid: boolean
  issues: string[]
  suggestions: string[]
}

export const REVIEW_COMMENT_MIN_LENGTH = 10
export const REVIEW_COMMENT_MAX_LENGTH = 500

const EXPLICIT_KEYWORDS = [
  'fuck', 'shit', 'bitch', 'ass', 'asshole', 'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
  'nigger', 'faggot', 'retard', 'idiot', 'stupid', 'dumb', 'moron', 'bastard',
  'motherfucker', 'fucker', 'shitty', 'fucking', 'damn', 'hell',
]

const AGGRESSIVE_WORDS = [
  'hate', 'terrible', 'awful', 'worst', 'horrible', 'disgusting', 'useless',
  'worthless', 'pathetic', 'ridiculous', 'stupid', 'idiot', 'moron',
]

// Not global: a /g regex keeps lastIndex between .test() calls.
const SPAM_PATTERNS = [
  /\b[A-Z]{3,}\b/, // shouting
  /!{3,}/,
  /\?{3,}/,
  /\.{4,}/,
  /\*{3,}/,
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordPattern(word: string, flags: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(word)}(?:s|es|ed|ing|er|ers)?\\b`, flags)
}

const EXPLICIT_PATTERNS = EXPLICIT_KEYWORDS.map((w) => ({ word: w, re: wordPattern(w, 'i') }))
const AGGRESSIVE_PATTERNS = AGGRESSIVE_WORDS.map((w) => wordPattern(w, 'i'))

/** The listed explicit words found in `text` (whole words, any case). */
export function findExplicitWords(text: string): string[] {
  if (!text) return []
  return EXPLICIT_PATTERNS.filter(({ re }) => re.test(text)).map(({ word }) => word)
}

export function containsExplicitLanguage(text: string): boolean {
  return findExplicitWords(text).length > 0
}

/** Full UI validation for a review comment. */
export function validateContent(text: string): ContentValidation {
  const issues: string[] = []
  const suggestions: string[] = []

  if (text.length < REVIEW_COMMENT_MIN_LENGTH) {
    issues.push(`Review must be at least ${REVIEW_COMMENT_MIN_LENGTH} characters long`)
    suggestions.push('Please provide more details about your experience')
  }
  if (text.length > REVIEW_COMMENT_MAX_LENGTH) {
    issues.push(`Review must be less than ${REVIEW_COMMENT_MAX_LENGTH} characters`)
    suggestions.push('Please keep your review concise')
  }

  if (containsExplicitLanguage(text)) {
    issues.push('Contains inappropriate language')
    suggestions.push('Please use respectful language in your review')
  }

  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push('Contains spam-like patterns (excessive caps, punctuation)')
    suggestions.push('Please write your review in a natural, respectful tone')
  }

  if (/(.)\1{4,}/.test(text)) {
    issues.push('Contains too many repetitive characters')
    suggestions.push('Please avoid excessive repetition')
  }

  if (AGGRESSIVE_PATTERNS.filter((re) => re.test(text)).length > 2) {
    issues.push('Contains overly negative language')
    suggestions.push('Please provide constructive feedback')
  }

  const words = text.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length < 3) {
    issues.push('Review is too short')
    suggestions.push('Please provide more details about your experience')
  }

  return { isValid: issues.length === 0, issues, suggestions }
}

/** Real-time status for UI feedback. */
export function getModerationStatus(text: string): 'clean' | 'flagged' {
  if (!text) return 'clean'
  return validateContent(text).isValid ? 'clean' : 'flagged'
}

/** Masks listed words with asterisks and tones down shouting and punctuation. */
export function sanitizeContent(text: string): string {
  let sanitized = text
  for (const word of EXPLICIT_KEYWORDS) {
    sanitized = sanitized.replace(wordPattern(word, 'gi'), (match) => '*'.repeat(match.length))
  }
  sanitized = sanitized.replace(/!{3,}/g, '!')
  sanitized = sanitized.replace(/\?{3,}/g, '?')
  sanitized = sanitized.replace(/\.{4,}/g, '...')
  sanitized = sanitized.replace(/\b[A-Z]{3,}\b/g, (match) => match.toLowerCase())
  return sanitized
}
