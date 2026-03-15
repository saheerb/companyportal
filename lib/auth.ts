import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { scrypt, timingSafeEqual } from "crypto";
import pool from "./db";

const DEBUG = process.env.DEBUG_AUTH === "true";
const log = (...args: unknown[]) => DEBUG && console.log("[auth]", ...args);

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, "happycardeals-admin", 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const derived = await hashPassword(password);
    return timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        log("authorize called, username:", credentials?.username);
        if (!credentials?.username || !credentials?.password) {
          log("missing credentials");
          return null;
        }
        let rows;
        try {
          ({ rows } = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [credentials.username]
          ));
          log("db query ok, rows found:", rows.length);
        } catch (err) {
          log("db query failed:", (err as Error).message);
          return null;
        }
        const user = rows[0];
        if (!user) { log("user not found"); return null; }
        if (!user.password_hash) { log("user has no password_hash"); return null; }
        const valid = await verifyPassword(credentials.password, user.password_hash);
        log("password valid:", valid);
        if (!valid) return null;
        return { id: String(user.id), name: user.username, email: user.username };
      },
    }),
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
