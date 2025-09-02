import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { User } from "@shared/schema";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Email o contraseña incorrectos" });
        }

        // Check if account is locked due to too many attempts
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          const timeSinceLastAttempt = user.lastLoginAttempt
            ? Date.now() - new Date(user.lastLoginAttempt).getTime()
            : LOGIN_ATTEMPT_WINDOW + 1;

          if (timeSinceLastAttempt < LOGIN_ATTEMPT_WINDOW) {
            const minutesLeft = Math.ceil((LOGIN_ATTEMPT_WINDOW - timeSinceLastAttempt) / 60000);
            return done(null, false, {
              message: `Cuenta bloqueada temporalmente. Intente de nuevo en ${minutesLeft} minutos.`,
            });
          } else {
            // Reset login attempts after window expires
            await db
              .update(users)
              .set({ loginAttempts: 0, lastLoginAttempt: null })
              .where(eq(users.id, user.id));
            user.loginAttempts = 0;
          }
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          // Increment login attempts
          await db
            .update(users)
            .set({
              loginAttempts: user.loginAttempts + 1,
              lastLoginAttempt: new Date(),
            })
            .where(eq(users.id, user.id));

          const attemptsLeft = MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);
          if (attemptsLeft > 0) {
            return done(null, false, {
              message: `Email o contraseña incorrectos. ${attemptsLeft} intentos restantes.`,
            });
          } else {
            return done(null, false, {
              message: "Cuenta bloqueada temporalmente debido a demasiados intentos fallidos.",
            });
          }
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0) {
          await db
            .update(users)
            .set({ loginAttempts: 0, lastLoginAttempt: null })
            .where(eq(users.id, user.id));
        }

        // Remove password from user object before returning
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        console.error("Error during authentication:", error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        role: users.role,
        familyId: users.familyId,
        notificationPreferences: users.notificationPreferences,
        loginAttempts: users.loginAttempts,
        lastLoginAttempt: users.lastLoginAttempt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;