import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { supabase } from './client/supabase';
import { v7 } from 'uuid';
import LineProvider from 'next-auth/providers/line';
import CredentialsProvider from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        if (credentials === null) return null;
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        const { data: userInfo, error } = await supabase
          .from('User')
          .select('*')
          .eq('email', email)
          .single();

        if (error) {
          return null;
        }

        if (userInfo && userInfo.passwordHash === password) {
          return {
            id: userInfo.id,
            name: userInfo.fullName,
            email: userInfo.email,
          };
        }

        return null;
      },
    }),
    LineProvider({
      clientId: process.env.AUTH_LINE_ID,
      clientSecret: process.env.AUTH_LINE_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async redirect({ baseUrl }) {
      return baseUrl;
    },
    async signIn({ account, user }) {
      console.log('aaaaa', account, user);
      try {
        await upsertUserAccount({
          type: 'oauth',
          provider: account?.provider as string,
          providerAccountId: account?.providerAccountId as string,
          email: user.email as string,
          idToken: account?.access_token as string,
        });

        return true;
      } catch (err) {
        console.debug('[next-auth] Custom upsert failed:', err);
        return false;
      }
    },
    async session({ token, session }) {
      console.debug(
        '[next-auth] session token.providerAccountId:',
        token.providerAccountId
      );

      const userId = await getUserIdByProviderAccountId(
        token.providerAccountId as string
      );

      if (userId) {
        session.user.id = userId;
      }

      return session;
    },
    async jwt({ token, trigger, session, account }) {
      // console.debug('[next-auth] jwt', {
      //   token,
      //   session,
      //   user,
      // });

      if (trigger === 'update' && session?.name) {
        token.name = session.name;
      }

      // Handle all OAuth providers during sign in
      if (trigger === 'signIn' && account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;

        // Provider-specific handling
        if (account.provider === 'google') {
          token.accessToken = account.id_token;
          token.providerID = 'google.com';
        } else if (account.provider === 'line') {
          token.accessToken = account.access_token;
          token.providerID = 'line';
        }
        // Add other providers as needed
      }

      return token;
    },
  },
});

type UpsertUserAccountParams = {
  provider: string;
  providerAccountId: string;
  type: string;
  email: string | null;
  idToken: string;
};

async function upsertUserAccount(params: UpsertUserAccountParams) {
  const { data: oAuthAccount, error: oAuthAccountError } =
    await supabase
      .from('OAuthAccount')
      .select('userId')
      .eq('provider', params.provider)
      .eq('providerAccountId', params.providerAccountId)
      .single();

  console.log('oAuthAccount', {
    data: oAuthAccount,
    error: oAuthAccountError,
  });

  if (oAuthAccount !== null) {
    return oAuthAccount.userId;
  }

  const { data: user, error: insertedUserError } = await supabase
    .from('User')
    .upsert({
      id: v7(),
      fullName: '',
      updatedAt: new Date().toUTCString(),
      username: v7(),
    })
    .select('id')
    .single();

  console.log('insertedUser', {
    data: user,
    error: insertedUserError,
  });

  if (user === null) {
    return;
  }

  const {
    data: insertedOAuthAccount,
    error: insertedOAuthAccountError,
  } = await supabase.from('OAuthAccount').insert({
    id: v7() as string,
    type: params.type,
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    userId: user.id,
  });

  console.log('insertedOAuthAccount', {
    data: insertedOAuthAccount,
    error: insertedOAuthAccountError,
  });

  return user.id;
}

async function getUserIdByProviderAccountId(
  providerAccountId: string
) {
  const { data: oAuthAccount, error: oAuthAccountError } =
    await supabase
      .from('OAuthAccount')
      .select('userId')
      .eq('providerAccountId', providerAccountId)
      .single();

  if (oAuthAccountError) {
    return null;
  }

  return oAuthAccount.userId;
}
