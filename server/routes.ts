import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const { category, search, favorites } = req.query;
      
      let recipes;
      if (favorites === 'true') {
        recipes = await storage.getFavoriteRecipes();
      } else if (category && category !== 'all') {
        recipes = await storage.getRecipesByCategory(category as string);
      } else if (search) {
        recipes = await storage.searchRecipes(search as string);
      } else {
        recipes = await storage.getAllRecipes();
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
        startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
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
