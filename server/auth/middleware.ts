import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import type { User } from "@shared/schema";

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