import { isOptimizableImage } from '../image'

describe('isOptimizableImage', () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original
  })

  it('accepts public Supabase storage URLs, local files and configured hosts', () => {
    expect(isOptimizableImage('https://abc.supabase.co/storage/v1/object/public/avatars/u/a.png')).toBe(true)
    expect(isOptimizableImage('/placeholder.svg')).toBe(true)
    expect(isOptimizableImage('https://lh3.googleusercontent.com/a/xyz')).toBe(true)
  })

  it('rejects anything next/image would throw on', () => {
    expect(isOptimizableImage('https://evil.example.com/a.png')).toBe(false)
    expect(isOptimizableImage('https://abc.supabase.co/storage/v1/object/sign/avatars/a.png')).toBe(false)
    expect(isOptimizableImage('https://other.supabase.co/storage/v1/object/public/a.png')).toBe(false)
    expect(isOptimizableImage('http://lh3.googleusercontent.com/a')).toBe(false)
    expect(isOptimizableImage('not a url')).toBe(false)
    expect(isOptimizableImage(null)).toBe(false)
  })
})
