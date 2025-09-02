import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema } from "@shared/schema";
import { z } from "zod";
import { checkDatabaseHealth } from "./db";
import authRouter from "./auth/routes";
import { apiRateLimit, isAuthenticated, attachUser, getCurrentUser } from "./auth/middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Smart health check at root - serves health check for deployment systems, React app for browsers
  app.get("/", async (req, res, next) => {
    // Check if this is a health check request from deployment system
    const isHealthCheck = req.headers['user-agent']?.includes('curl') || 
                         req.headers['user-agent']?.includes('health') ||
                         req.headers['accept']?.includes('application/json') ||
                         req.query.health === 'check';
    
    if (isHealthCheck && process.env.NODE_ENV === 'production') {
      try {
        const dbHealth = await checkDatabaseHealth();
        
        if (!dbHealth.healthy) {
          return res.status(503).json({ 
            status: "unhealthy", 
            message: "Database connection failed",
            database: dbHealth,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development"
          });
        }

        return res.status(200).json({ 
          status: "ok", 
          message: "Menu Familiar API is running",
          database: { healthy: true },
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development"
        });
      } catch (error) {
        return res.status(503).json({ 
          status: "error", 
          message: "Health check failed",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // For all other requests, continue to static file serving
    next();
  });

  // Main health check route for deployment systems
  app.get("/api/health-check", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      
      if (!dbHealth.healthy) {
        return res.status(503).json({ 
          status: "unhealthy", 
          message: "Database connection failed",
          database: dbHealth,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development"
        });
      }

      res.status(200).json({ 
        status: "ok", 
        message: "Menu Familiar API is running",
        database: { healthy: true },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      });
    } catch (error) {
      res.status(503).json({ 
        status: "error", 
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check endpoint (alternative path)
  app.get("/health", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      res.status(dbHealth.healthy ? 200 : 503).json({ 
        status: dbHealth.healthy ? "healthy" : "unhealthy", 
        database: dbHealth,
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({ 
        status: "error", 
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Authentication Routes
  app.use("/api/auth", authRouter);

  // Apply general rate limiting to all API routes
  app.use("/api", apiRateLimit);
  
  // Attach user information to all requests
  app.use("/api", attachUser);

  // Recipe routes
  app.get("/api/recipes", isAuthenticated, async (req, res) => {
    try {
      const { category, search, favorites } = req.query;
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      let recipes;
      
      // Start with all recipes or favorites for this user
      if (favorites === 'true') {
        recipes = await storage.getFavoriteRecipes(userId);
      } else {
        recipes = await storage.getAllRecipes(userId);
      }
      
      // Apply category filter
      if (category && category !== 'all') {
        recipes = recipes.filter(recipe => recipe.categoria === category);
      }
      
      // Apply search filter
      if (search && typeof search === 'string' && search.trim() !== '') {
        const searchTerm = search.toLowerCase().trim();
        recipes = recipes.filter(recipe => 
          recipe.nombre.toLowerCase().includes(searchTerm) ||
          recipe.descripcion?.toLowerCase().includes(searchTerm) ||
          recipe.categoria.toLowerCase().includes(searchTerm) ||
          recipe.ingredientes?.some(ing => ing.toLowerCase().includes(searchTerm))
        );
      }
      
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener las recetas" });
    }
  });

  app.get("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      const recipe = await storage.getRecipeById(id, userId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener la receta" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const recipeData = insertRecipeSchema.parse(req.body);
      // Ensure the recipe belongs to the current user
      const recipeWithUser = { ...recipeData, userId: user.id };
      const recipe = await storage.createRecipe(recipeWithUser);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de receta inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear la receta" });
    }
  });

  app.put("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      const updateData = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(id, updateData, userId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de receta inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar la receta" });
    }
  });

  app.delete("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      // Check if recipe is used in meal plans (user-specific)
      const isUsed = await storage.isRecipeUsedInMealPlans(id, userId);
      if (isUsed) {
        return res.status(400).json({ 
          error: "No se puede eliminar la receta porque está asignada a uno o más días de la semana. Primero elimine la receta de la planificación semanal." 
        });
      }
      
      const deleted = await storage.deleteRecipe(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json({ message: "Receta eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar la receta" });
    }
  });

  // Meal plan routes
  app.get("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const { startDate, date } = req.query;
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      let mealPlans;
      if (startDate) {
        mealPlans = await storage.getMealPlansForWeek(startDate as string, userId);
      } else if (date) {
        mealPlans = await storage.getMealPlanByDate(date as string, userId);
      } else {
        // Default to current week
        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        // Format date correctly in local timezone
        const year = startOfWeek.getFullYear();
        const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
        const day = String(startOfWeek.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        mealPlans = await storage.getMealPlansForWeek(formattedDate, userId);
      }
      
      res.json(mealPlans);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener el plan de comidas" });
    }
  });

  app.post("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const mealPlanData = insertMealPlanSchema.parse(req.body);
      // Ensure the meal plan belongs to the current user
      const mealPlanWithUser = { ...mealPlanData, userId: user.id };
      const mealPlan = await storage.createMealPlan(mealPlanWithUser);
      res.status(201).json(mealPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos del plan de comida inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear el plan de comida" });
    }
  });

  app.put("/api/meal-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      const updateData = insertMealPlanSchema.partial().parse(req.body);
      const mealPlan = await storage.updateMealPlan(id, updateData, userId);
      
      if (!mealPlan) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }
      
      res.json(mealPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos del plan de comida inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar el plan de comida" });
    }
  });

  app.delete("/api/meal-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      const deleted = await storage.deleteMealPlan(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }
      
      res.json({ message: "Plan de comida eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar el plan de comida" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
