export function normalizeUsername(username: string): string {
  return username.trim();
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const normalizedEmail = email?.trim();
  return normalizedEmail || null;
}
