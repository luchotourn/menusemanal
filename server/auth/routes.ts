import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import passport from "./passport";
import { db } from "../db";
import { users, insertUserSchema, loginSchema, updateProfileSchema, changePasswordSchema, avatarUploadSchema, accountDeletionSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authRateLimit, isAuthenticated } from "./middleware";
import { z } from "zod";
import { storage } from "../storage";

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
        avatar: users.avatar,
        role: users.role,
        notificationPreferences: users.notificationPreferences,
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
            role: user.role
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

// Profile Management Routes

// Get user profile
authRouter.get("/profile", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    // Parse notification preferences from JSON string
    let notificationPreferences;
    try {
      notificationPreferences = user.notificationPreferences 
        ? JSON.parse(user.notificationPreferences) 
        : { email: true, recipes: true, mealPlans: true };
    } catch (error) {
      notificationPreferences = { email: true, recipes: true, mealPlans: true };
    }

    // Get user's families to provide correct family information
    const userFamilies = await storage.getUserFamilies(user.id);
    const primaryFamily = userFamilies[0]; // Single family per user constraint

    // Add no-cache headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        familyId: primaryFamily?.id,
        familyName: primaryFamily?.nombre,
        familyInviteCode: primaryFamily?.codigoInvitacion,
        notificationPreferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: "Error al obtener el perfil del usuario" });
  }
});

// Update user profile
authRouter.put("/profile", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validatedData = updateProfileSchema.parse(req.body);

    // Check if email is being changed and if it's already in use
    if (validatedData.email !== user.email) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, validatedData.email.toLowerCase()))
        .limit(1);

      if (existingUser && existingUser.id !== user.id) {
        return res.status(409).json({
          message: "El email ya está en uso por otro usuario",
          error: "EMAIL_ALREADY_EXISTS"
        });
      }
    }

    // Prepare update data
    const updateData: any = {
      name: validatedData.name,
      email: validatedData.email.toLowerCase(),
      updatedAt: new Date(),
    };

    // Handle avatar update
    if (validatedData.avatar !== undefined) {
      updateData.avatar = validatedData.avatar;
    }

    // Handle notification preferences
    if (validatedData.notificationPreferences) {
      updateData.notificationPreferences = JSON.stringify(validatedData.notificationPreferences);
    }

    // Update user in database
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        role: users.role,
        notificationPreferences: users.notificationPreferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // Parse notification preferences for response
    let notificationPreferences;
    try {
      notificationPreferences = updatedUser.notificationPreferences 
        ? JSON.parse(updatedUser.notificationPreferences) 
        : { email: true, recipes: true, mealPlans: true };
    } catch (error) {
      notificationPreferences = { email: true, recipes: true, mealPlans: true };
    }

    res.json({
      message: "Perfil actualizado exitosamente",
      user: {
        ...updatedUser,
        notificationPreferences
      }
    });

  } catch (error) {
    console.error("Profile update error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de perfil inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    res.status(500).json({
      message: "Error al actualizar el perfil",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Change password
authRouter.post("/change-password", isAuthenticated, authRateLimit, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validatedData = changePasswordSchema.parse(req.body);

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        message: "La contraseña actual es incorrecta",
        error: "INVALID_CURRENT_PASSWORD"
      });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(validatedData.newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "La nueva contraseña debe ser diferente a la actual",
        error: "SAME_PASSWORD"
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // Update password in database
    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        loginAttempts: 0, // Reset login attempts on password change
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    res.json({
      message: "Contraseña cambiada exitosamente"
    });

  } catch (error) {
    console.error("Password change error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de cambio de contraseña inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    res.status(500).json({
      message: "Error al cambiar la contraseña",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Upload/Update avatar
authRouter.post("/avatar", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validatedData = avatarUploadSchema.parse(req.body);

    // Update avatar in database
    const [updatedUser] = await db
      .update(users)
      .set({
        avatar: validatedData.avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        avatar: users.avatar,
      });

    res.json({
      message: "Avatar actualizado exitosamente",
      avatar: updatedUser.avatar
    });

  } catch (error) {
    console.error("Avatar update error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de avatar inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    res.status(500).json({
      message: "Error al actualizar el avatar",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Delete account
authRouter.delete("/account", isAuthenticated, authRateLimit, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validatedData = accountDeletionSchema.parse(req.body);

    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Contraseña incorrecta",
        error: "INVALID_PASSWORD"
      });
    }

    // Delete user (this will cascade to delete recipes and meal plans due to foreign key constraints)
    await db.delete(users).where(eq(users.id, user.id));

    // Log out the user
    req.logout((err) => {
      if (err) {
        console.error("Logout error after account deletion:", err);
      }
      
      // Destroy session
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error after account deletion:", destroyErr);
        }
        
        // Clear session cookie
        res.clearCookie("menu.sid");
        res.json({
          message: "Cuenta eliminada exitosamente"
        });
      });
    });

  } catch (error) {
    console.error("Account deletion error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Datos de eliminación de cuenta inválidos",
        errors: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }

    res.status(500).json({
      message: "Error al eliminar la cuenta",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

export default authRouter;