import type { NextAuthConfig } from "next-auth";

export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

/**
 * Auth.js settings with no database or Node-only imports. `proxy.ts` uses this
 * to check the session cookie cheaply. The full config (credentials provider,
 * events) is in auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE, updateAge: 15 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present right after a successful sign-in.
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        token.sid = user.sid;
      }
      return token;
    },
    session({ session, token }) {
      // Exposes only non-secret identifiers. The role here is used for display only;
      // authorization always re-reads the role from MongoDB.
      session.user.id = token.uid;
      session.user.role = token.role;
      session.sid = token.sid;
      return session;
    },
  },
} satisfies NextAuthConfig;
