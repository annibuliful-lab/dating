import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      jwtToken: string;
      refreshToken: string;
      role?: "USER" | "ADMIN";
      status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "USER" | "ADMIN";
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  }
}
