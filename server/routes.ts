import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema } from "@shared/schema";
import { z } from "zod";
import { checkDatabaseHealth } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check route for deployment (with database check)
  app.get("/", async (req, res) => {
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

  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const { category, search, favorites } = req.query;
      
      let recipes;
      
      // Start with all recipes or favorites
      if (favorites === 'true') {
        recipes = await storage.getFavoriteRecipes();
      } else {
        recipes = await storage.getAllRecipes();
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

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipeById(id);
      
      if (!recipe) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener la receta" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const recipeData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de receta inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear la receta" });
    }
  });

  app.put("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(id, updateData);
      
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

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if recipe is used in meal plans
      const isUsed = await storage.isRecipeUsedInMealPlans(id);
      if (isUsed) {
        return res.status(400).json({ 
          error: "No se puede eliminar la receta porque está asignada a uno o más días de la semana. Primero elimine la receta de la planificación semanal." 
        });
      }
      
      const deleted = await storage.deleteRecipe(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json({ message: "Receta eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar la receta" });
    }
  });

  // Meal plan routes
  app.get("/api/meal-plans", async (req, res) => {
    try {
      const { startDate, date } = req.query;
      
      let mealPlans;
      if (startDate) {
        mealPlans = await storage.getMealPlansForWeek(startDate as string);
      } else if (date) {
        mealPlans = await storage.getMealPlanByDate(date as string);
      } else {
        // Default to current week
        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        mealPlans = await storage.getMealPlansForWeek(startOfWeek.toISOString().split('T')[0]);
      }
      
      res.json(mealPlans);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener el plan de comidas" });
    }
  });

  app.post("/api/meal-plans", async (req, res) => {
    try {
      const mealPlanData = insertMealPlanSchema.parse(req.body);
      const mealPlan = await storage.createMealPlan(mealPlanData);
      res.status(201).json(mealPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos del plan de comida inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear el plan de comida" });
    }
  });

  app.put("/api/meal-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertMealPlanSchema.partial().parse(req.body);
      const mealPlan = await storage.updateMealPlan(id, updateData);
      
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

  app.delete("/api/meal-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteMealPlan(id);
      
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
