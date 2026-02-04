/**
 * Utility to create Supabase-compatible JWT tokens for RLS
 * This allows next-auth users to enforce Row Level Security policies
 */

import * as jwt from 'jsonwebtoken';

export interface JWTPayload {
  sub: string; // user id
  email?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  role?: string;
}

/**
 * Generate a JWT token compatible with Supabase RLS
 * @param userId - The user's ID
 * @param email - The user's email
 * @param expiresIn - Token expiration time in seconds (default: 1 hour)
 * @returns Signed JWT token
 */
export function generateSupabaseJWT(
  userId: string,
  email?: string,
  expiresIn: number = 3600,
): string {
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET is not set. Please add it to your environment variables.',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + expiresIn,
    iss: 'supabase',
    aud: 'authenticated',
    role: 'authenticated', // required for RLS to work
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    noTimestamp: false,
  });
}

/**
 * Create a short-lived token for API requests (5 minutes)
 * Useful for API route handlers
 */
export function generateShortLivedToken(
  userId: string,
  email?: string,
): string {
  return generateSupabaseJWT(userId, email, 300); // 5 minutes
}

/**
 * Decode and verify a JWT token
 * @param token - The token to verify
 * @returns Decoded payload if valid
 */
export function verifySupabaseJWT(token: string): JWTPayload | null {
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not set');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
