export function isValidEmail(email: string): boolean {
  // Registration uses the email address as the initial username. Keep both
  // values lowercase and whitespace-free so their uniqueness is predictable.
  const emailRegex = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return !/\s/.test(email) && emailRegex.test(email);
}
