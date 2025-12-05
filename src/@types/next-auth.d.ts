import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      jwtToken: string;
      refreshToken: string;
    } & DefaultSession['user'];
  }
}
