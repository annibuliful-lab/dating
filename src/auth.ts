import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { supabase } from './client/supabase';
import { v7 } from 'uuid';
import LineProvider from 'next-auth/providers/line';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    LineProvider({
      clientId: '2007684310',
      clientSecret: '24a3156747af3bc7e65fa6b733d8034f',
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
    async redirect({ url, baseUrl }) {
      const redirectUrl = url.startsWith('/')
        ? new URL(url, baseUrl).toString()
        : url;

      console.debug(
        `[next-auth] Redirecting to "${redirectUrl}" (resolved from url "${url}" and baseUrl "${baseUrl}")`
      );

      return redirectUrl;
    },
    async signIn({ user, account, profile, ...rest }) {
      console.debug('[next-auth] signin:', {
        user,
        account,
        profile,
        rest,
      });

      try {
        await upsertUserAccount({
          type: 'oauth',
          provider: account?.provider as string,
          providerAccountId: account?.providerAccountId as string,
        });
      } catch (err) {
        console.debug('[next-auth] Custom upsert failed:', err);
        return false;
      }

      return true;
    },
    async session({ token, session, ...rest }) {
      console.debug('[next-auth] session', { token, session, rest });

      if (!token.accessToken) return session;

      return session;
    },
    async jwt({
      token,
      trigger,
      session,
      account,
      profile,
      ...rest
    }) {
      console.debug('[next-auth] jwt', {
        account,
        token,
        trigger,
        session,
        profile,
        rest,
      });

      if (trigger === 'update' && session?.name) {
        // Note, that `session` can be any arbitrary object, remember to validate it!
        token.name = session.name;
      }

      if (trigger === 'signIn' && account?.provider === 'google') {
        token.accessToken = account?.id_token;
        token.provider = 'google';
        token.providerID = 'google.com';
      }

      return token;
    },
  },
});

type UpsertUserAccountParams = {
  provider: string;
  providerAccountId: string;
  type: string;
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

  if (oAuthAccount === null) {
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
  }
}
