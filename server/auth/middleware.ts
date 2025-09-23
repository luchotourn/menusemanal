import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import type { User } from "@shared/schema";
import { storage } from "../storage";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, "password"> {}
  }
}

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ 
    message: "No autorizado. Por favor inicie sesión.",
    error: "UNAUTHORIZED" 
  });
};

// Middleware to check if user is admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      message: "No autorizado. Por favor inicie sesión.",
      error: "UNAUTHORIZED" 
    });
  }

  const user = req.user as User;
  if (user.role !== "admin") {
    return res.status(403).json({ 
      message: "Acceso denegado. Se requieren permisos de administrador.",
      error: "FORBIDDEN" 
    });
  }

  next();
};

// Optional authentication - continues even if not authenticated
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  next();
};

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Demasiados intentos. Por favor intente de nuevo más tarde.",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  handler: (req, res) => {
    res.status(429).json({
      message: "Demasiados intentos de autenticación. Por favor espere 15 minutos.",
      error: "TOO_MANY_REQUESTS"
    });
  }
});

// General API rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Demasiadas solicitudes. Por favor intente de nuevo más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Rate limiting for family code generation/regeneration
export const familyCodeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 code generation requests per hour
  message: "Demasiados intentos de generación de códigos. Por favor intente de nuevo más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts to prevent spam
  handler: (req, res) => {
    res.status(429).json({
      message: "Límite de generación de códigos alcanzado. Por favor espere 1 hora antes de generar nuevos códigos.",
      error: "TOO_MANY_REQUESTS"
    });
  }
});

// Helper to get current user from request
export const getCurrentUser = (req: Request): User | null => {
  if (req.isAuthenticated() && req.user) {
    return req.user as User;
  }
  return null;
};

// Middleware to attach user to response locals for easy access
export const attachUser = (req: Request, res: Response, next: NextFunction) => {
  res.locals.user = getCurrentUser(req);
  next();
};

// Role-based access control middleware
export const requireRole = (requiredRole: 'creator' | 'commentator') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "No autorizado. Por favor inicie sesión.",
        error: "UNAUTHORIZED"
      });
    }

    const user = req.user as User;
    if (user.role !== requiredRole) {
      return res.status(403).json({
        message: `Permisos insuficientes. Se requiere rol de ${requiredRole}.`,
        error: "INSUFFICIENT_PERMISSIONS",
        required: requiredRole,
        current: user.role
      });
    }

    next();
  };
};

// Convenience middleware for specific roles
export const requireCreatorRole = requireRole('creator');
export const requireCommentatorRole = requireRole('commentator');

// Middleware to ensure user can only access their family's data
export const requireFamilyAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "No autorizado. Por favor inicie sesión.",
        error: "UNAUTHORIZED"
      });
    }

    const user = req.user as User;

    // Extract family ID from various possible sources
    const resourceFamilyId = req.params.familyId ||
                            req.body.familyId ||
                            req.query.familyId ||
                            req.params.id; // For family-specific resources

    if (resourceFamilyId) {
      const userFamilies = await storage.getUserFamilies(user.id);
      const hasAccess = userFamilies.some(family =>
        family.id.toString() === resourceFamilyId.toString()
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: "Acceso denegado. No tienes permisos para acceder a esta familia.",
          error: "FAMILY_ACCESS_DENIED"
        });
      }
    }

    next();
  } catch (error) {
    console.error('Family access validation error:', error);
    res.status(500).json({
      message: "Error al validar acceso familiar",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
};

// Middleware to check if user can edit family data (creator only within their family)
export const requireFamilyEditAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "No autorizado. Por favor inicie sesión.",
        error: "UNAUTHORIZED"
      });
    }

    const user = req.user as User;

    // Only creators can edit family data
    if (user.role !== 'creator') {
      return res.status(403).json({
        message: "Solo los creadores pueden modificar datos familiares.",
        error: "CREATOR_REQUIRED"
      });
    }

    // Check family access
    const resourceFamilyId = req.params.familyId ||
                            req.body.familyId ||
                            req.query.familyId;

    if (resourceFamilyId) {
      const userFamilies = await storage.getUserFamilies(user.id);
      const hasAccess = userFamilies.some(family =>
        family.id.toString() === resourceFamilyId.toString()
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: "No tienes permisos para modificar esta familia.",
          error: "FAMILY_EDIT_DENIED"
        });
      }
    }

    next();
  } catch (error) {
    console.error('Family edit access validation error:', error);
    res.status(500).json({
      message: "Error al validar permisos de edición",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
};

// Rate limiting specific to commentator actions (more restrictive)
export const commentatorRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit commentators to 20 actions per 5 minutes
  message: "Demasiadas acciones. Por favor espera un momento antes de continuar.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Has realizado muchas acciones seguidas. Por favor espera 5 minutos.",
      error: "TOO_MANY_ACTIONS"
    });
  }
});