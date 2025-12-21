import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LineProvider from "next-auth/providers/line";
import { v7 } from "uuid";
import { supabase } from "./client/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
    error: "/auth/error",
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
          .from("User")
          .select("*")
          .eq("email", email)
          .single();

        if (error) {
          return null;
        }

        // Check if user is suspended
        if (userInfo && userInfo.status === "SUSPENDED") {
          throw new Error("บัญชีของคุณถูกพักการใช้งานชั่วคราว");
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
      authorization: {
        params: {
          scope: "profile openid email",
          bot_prompt: "normal",
        },
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Redirect to feed page after login
      if (url.startsWith(baseUrl)) {
        // If it's a callback URL, redirect to feed (new users will be handled in session callback)
        if (url.includes("/api/auth/callback")) {
          return `${baseUrl}/feed`;
        }
        return url;
      }

      // If URL doesn't start with baseUrl, redirect to feed as fallback
      return `${baseUrl}/feed`;
    },
    async signIn({ account, user }) {
      try {
        if (!account?.provider || !account?.providerAccountId) {
          console.error(
            "[next-auth] Missing account provider or providerAccountId"
          );
          return false;
        }

        const result = await upsertUserAccount({
          type: "oauth",
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email as string,
          idToken: account.access_token as string,
        });

        if (!result) {
          console.error("[next-auth] upsertUserAccount returned null");
          return false;
        }

        // Check if user is suspended (for existing users)
        if (!result.isNewUser) {
          const { data: userInfo, error } = await supabase
            .from("User")
            .select("status")
            .eq("id", result.userId)
            .single();

          if (!error && userInfo && userInfo.status === "SUSPENDED") {
            console.error("[next-auth] User is suspended:", result.userId);
            throw new Error("บัญชีของคุณถูกพักการใช้งานชั่วคราว");
          }
        }

        // Store isNewUser flag in account for JWT callback
        (account as Record<string, unknown>).isNewUser = result.isNewUser;
        (account as Record<string, unknown>).userId = result.userId;

        return true;
      } catch (err) {
        console.error("[next-auth] signIn callback error:", err);
        // If error message contains suspension message, throw it
        if (err instanceof Error && err.message.includes("พักการใช้งาน")) {
          throw err;
        }
        return false;
      }
    },
    async session({ token, session }) {
      console.debug(
        "[next-auth] session token.providerAccountId:",
        token.providerAccountId
      );

      const userId = await getUserIdByProviderAccountId(
        token.providerAccountId as string
      );

      if (userId) {
        session.user.id = userId;

        // Check if user is suspended during session
        const { data: userInfo, error } = await supabase
          .from("User")
          .select("status")
          .eq("id", userId)
          .single();

        if (!error && userInfo && userInfo.status === "SUSPENDED") {
          // Store suspended status in session
          (session as unknown as Record<string, unknown>).isSuspended = true;
        }
      }

      // Store isNewUser in session for redirect logic
      if (token.isNewUser) {
        (session as unknown as Record<string, unknown>).isNewUser = true;
        (session as unknown as Record<string, unknown>).newUserId =
          token.newUserId;
      }

      return session;
    },
    async jwt({ token, trigger, session, account }) {
      // console.debug('[next-auth] jwt', {
      //   token,
      //   session,
      //   user,
      // });

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      // Handle all OAuth providers during sign in
      if (trigger === "signIn" && account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;

        // Store if this is a new user for redirect logic
        const accountWithExtras = account as Record<string, unknown>;
        if (accountWithExtras.isNewUser) {
          token.isNewUser = true;
          token.newUserId = accountWithExtras.userId as string;
        }

        // Provider-specific handling
        if (account.provider === "google") {
          token.accessToken = account.id_token;
          token.providerID = "google.com";
        } else if (account.provider === "line") {
          token.accessToken = account.access_token;
          token.providerID = "line";
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

async function upsertUserAccount(
  params: UpsertUserAccountParams
): Promise<{ userId: string; isNewUser: boolean } | null> {
  try {
    const { data: oAuthAccount, error: oAuthAccountError } = await supabase
      .from("OAuthAccount")
      .select("userId")
      .eq("provider", params.provider)
      .eq("providerAccountId", params.providerAccountId)
      .single();

    // PGRST116 means no rows returned, which is expected for new users
    if (oAuthAccountError && oAuthAccountError.code !== "PGRST116") {
      console.error(
        "[upsertUserAccount] Error checking existing OAuth account:",
        oAuthAccountError
      );
      return null;
    }

    // If user already exists, return their userId (not a new user)
    if (oAuthAccount !== null) {
      return { userId: oAuthAccount.userId, isNewUser: false };
    }

    // Create new user with proper status
    const userId = v7();
    const { data: user, error: insertedUserError } = await supabase
      .from("User")
      .insert({
        id: userId,
        fullName: "",
        status: "ACTIVE", // User status: Active (ปกติใช้งาน)
        isVerified: false, // Verify status: Under review (รอยืนยันตัวตน)
        updatedAt: new Date().toUTCString(),
        username: v7(),
      })
      .select("id")
      .single();

    if (user === null || insertedUserError) {
      console.error(
        "[upsertUserAccount] Failed to create user:",
        insertedUserError
      );
      return null;
    }

    // Create OAuth account link
    const { error: insertedOAuthAccountError } = await supabase
      .from("OAuthAccount")
      .insert({
        id: v7() as string,
        type: params.type,
        provider: params.provider,
        providerAccountId: params.providerAccountId,
        userId: user.id,
      });

    if (insertedOAuthAccountError) {
      console.error(
        "[upsertUserAccount] Failed to create OAuth account:",
        insertedOAuthAccountError
      );
      return null;
    }

    return { userId: user.id, isNewUser: true };
  } catch (error) {
    console.error("[upsertUserAccount] Unexpected error:", error);
    return null;
  }
}

async function getUserIdByProviderAccountId(
  providerAccountId: string | undefined
) {
  if (!providerAccountId) {
    console.error(
      "[getUserIdByProviderAccountId] providerAccountId is undefined"
    );
    return null;
  }

  const { data: oAuthAccount, error: oAuthAccountError } = await supabase
    .from("OAuthAccount")
    .select("userId")
    .eq("providerAccountId", providerAccountId)
    .single();

  if (oAuthAccountError) {
    console.error("[getUserIdByProviderAccountId] Error:", oAuthAccountError);
    return null;
  }

  return oAuthAccount.userId;
}
