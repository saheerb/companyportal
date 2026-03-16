import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import pool from "./db";

const DEBUG = process.env.DEBUG_AUTH === "true";
const log = (...args: unknown[]) => DEBUG && console.log("[auth]", ...args);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/auth-error" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      log("signIn callback, provider:", account?.provider);
      if (account?.provider === "google") {
        if (!profile?.email) { log("google: no email in profile"); return false; }
        log("google: checking email:", profile.email);
        let rows;
        try {
          ({ rows } = await pool.query(
            "SELECT id FROM users WHERE google_email = $1",
            [profile.email]
          ));
          log("google: db rows found:", rows.length);
        } catch (err) {
          log("google: db query failed:", (err as Error).message);
          return false;
        }
        return rows.length > 0;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};
