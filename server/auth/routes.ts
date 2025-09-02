import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import passport from "./passport";
import { db } from "../db";
import { users, insertUserSchema, loginSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authRateLimit, isAuthenticated } from "./middleware";
import { z } from "zod";

const authRouter = Router();

// Register new user
authRouter.post("/register", authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = insertUserSchema.parse(req.body);

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({
        message: "El email ya está registrado",
        error: "EMAIL_ALREADY_EXISTS"
      });
    }

    // Hash password with bcrypt (10 salt rounds as per requirements)
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        ...validatedData,
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        familyId: users.familyId,
        loginAttempts: users.loginAttempts,
        lastLoginAttempt: users.lastLoginAttempt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // Log the user in immediately after registration
    req.login(newUser, (err) => {
      if (err) {
        console.error("Error logging in after registration:", err);
        return res.status(201).json({
          message: "Usuario creado exitosamente. Por favor inicie sesión.",
          user: newUser
        });
      }

      res.status(201).json({
        message: "Usuario creado y sesión iniciada exitosamente",
        user: newUser
      });
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de registro inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    res.status(500).json({
      message: "Error al crear el usuario",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Login user
authRouter.post("/login", authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({
          message: "Error durante la autenticación",
          error: "AUTHENTICATION_ERROR"
        });
      }

      if (!user) {
        return res.status(401).json({
          message: info?.message || "Email o contraseña incorrectos",
          error: "INVALID_CREDENTIALS"
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.status(500).json({
            message: "Error al iniciar sesión",
            error: "LOGIN_ERROR"
          });
        }

        res.json({
          message: "Sesión iniciada exitosamente",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            familyId: user.familyId
          }
        });
      });
    })(req, res, next);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de inicio de sesión inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    console.error("Login error:", error);
    res.status(500).json({
      message: "Error al iniciar sesión",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Logout user
authRouter.post("/logout", isAuthenticated, (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({
        message: "Error al cerrar sesión",
        error: "LOGOUT_ERROR"
      });
    }

    // Destroy session completely
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error("Session destroy error:", destroyErr);
        return res.status(500).json({
          message: "Error al destruir la sesión",
          error: "SESSION_DESTROY_ERROR"
        });
      }

      // Clear session cookie
      res.clearCookie("menu.sid");
      res.json({
        message: "Sesión cerrada exitosamente"
      });
    });
  });
});

// Get current user
authRouter.get("/me", isAuthenticated, (req: Request, res: Response) => {
  const user = req.user as any;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      familyId: user.familyId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

// Check authentication status
authRouter.get("/status", (req: Request, res: Response) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? {
      id: (req.user as any).id,
      email: (req.user as any).email,
      name: (req.user as any).name,
      role: (req.user as any).role
    } : null
  });
});

export default authRouter;