import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string"
            ? credentials.username
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (
          !process.env.ADMIN_USERNAME ||
          !process.env.ADMIN_PASSWORD_HASH ||
          username !== process.env.ADMIN_USERNAME
        ) {
          return null;
        }

        const passwordMatches = await compare(
          password,
          process.env.ADMIN_PASSWORD_HASH
        );

        if (!passwordMatches) {
          return null;
        }

        return { id: "admin", name: "Admin" };
      },
    }),
  ],
});
