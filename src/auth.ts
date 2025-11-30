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
      return `${baseUrl}/feed`;
    },
    async signIn({ account, user }) {
      console.log("aaaaa", account, user);
      try {
        const result = await upsertUserAccount({
          type: "oauth",
          provider: account?.provider as string,
          providerAccountId: account?.providerAccountId as string,
          email: user.email as string,
          idToken: account?.access_token as string,
        });

        // Check if user is suspended (for existing users)
        if (result && !result.isNewUser) {
          const { data: userInfo, error } = await supabase
            .from("User")
            .select("status")
            .eq("id", result.userId)
            .single();

          if (!error && userInfo && userInfo.status === "SUSPENDED") {
            throw new Error("บัญชีของคุณถูกพักการใช้งานชั่วคราว");
          }
        }

        // Store isNewUser flag in account for JWT callback
        if (account && result) {
          (account as any).isNewUser = result.isNewUser;
          (account as any).userId = result.userId;
        }

        return true;
      } catch (err) {
        console.debug("[next-auth] Custom upsert failed:", err);
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
          (session as any).isSuspended = true;
        }
      }

      // Store isNewUser in session for redirect logic
      if (token.isNewUser) {
        (session as any).isNewUser = true;
        (session as any).newUserId = token.newUserId;
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
        if ((account as any).isNewUser) {
          token.isNewUser = true;
          token.newUserId = (account as any).userId;
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
  const { data: oAuthAccount, error: oAuthAccountError } = await supabase
    .from("OAuthAccount")
    .select("userId")
    .eq("provider", params.provider)
    .eq("providerAccountId", params.providerAccountId)
    .single();

  console.log("oAuthAccount", {
    data: oAuthAccount,
    error: oAuthAccountError,
  });

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

  console.log("insertedUser", {
    data: user,
    error: insertedUserError,
  });

  if (user === null || insertedUserError) {
    console.error("Failed to create user:", insertedUserError);
    return null;
  }

  const { data: insertedOAuthAccount, error: insertedOAuthAccountError } =
    await supabase.from("OAuthAccount").insert({
      id: v7() as string,
      type: params.type,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      userId: user.id,
    });

  console.log("insertedOAuthAccount", {
    data: insertedOAuthAccount,
    error: insertedOAuthAccountError,
  });

  return { userId: user.id, isNewUser: true };
}

async function getUserIdByProviderAccountId(providerAccountId: string) {
  const { data: oAuthAccount, error: oAuthAccountError } = await supabase
    .from("OAuthAccount")
    .select("userId")
    .eq("providerAccountId", providerAccountId)
    .single();

  if (oAuthAccountError) {
    return null;
  }

  return oAuthAccount.userId;
}
