import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth/auth.config";
import { authorizeAdmin } from "@/lib/auth/authorize";
import { connectDB } from "@/lib/db";
import { AdminSession } from "@/models/AdminSession";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: authorizeAdmin,
    }),
  ],
  events: {
    // Logout deletes the server-side session record, so the JWT stops working
    // right away, even if a copy of the cookie still exists somewhere.
    async signOut(message) {
      const sid = "token" in message ? message.token?.sid : undefined;
      if (!sid) return;
      try {
        await connectDB();
        await AdminSession.deleteOne({ sid });
      } catch {
        console.error("[auth] could not delete session record on sign-out");
      }
    },
  },
});
