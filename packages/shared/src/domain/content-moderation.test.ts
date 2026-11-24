import assert from 'node:assert/strict'
import {
  containsExplicitLanguage,
  findExplicitWords,
  getModerationStatus,
  sanitizeContent,
  validateContent,
} from './content-moderation'

// Whole-word matching: no false positives inside other words.
assert.equal(containsExplicitLanguage('Great class, hello everyone, assessment passed'), false)
assert.equal(containsExplicitLanguage('What the HELL'), true)
assert.equal(containsExplicitLanguage('such an asshole'), true)
assert.equal(containsExplicitLanguage('bitches everywhere'), true)
assert.deepEqual(findExplicitWords('damn, shit'), ['shit', 'damn'])
assert.equal(containsExplicitLanguage(''), false)

// Repeated calls give the same answer (no global-regex lastIndex state).
for (let i = 0; i < 3; i++) {
  assert.equal(validateContent('GREAT cut and friendly staff').isValid, false)
}

assert.equal(validateContent('Great fade, very friendly and on time.').isValid, true)
assert.equal(validateContent('Good').isValid, false)
assert.equal(validateContent('Nice cut... would come back').isValid, true)
assert.equal(validateContent('a'.repeat(501)).isValid, false)
assert.equal(validateContent('terrible awful horrible experience overall').isValid, false)
assert.equal(getModerationStatus(''), 'clean')
assert.equal(getModerationStatus('this shit was great honestly'), 'flagged')

assert.equal(sanitizeContent('what the hell!!!'), 'what the ****!')
assert.equal(sanitizeContent('Hello class'), 'Hello class')
assert.equal(sanitizeContent('WOW nice'), 'wow nice')

console.log('content-moderation tests passed')
