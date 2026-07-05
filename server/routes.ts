import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema, createFamilySchema, joinFamilySchema, insertWaitlistSignupSchema, createMealProposalSchema, reviewMealProposalSchema, submitWeeklyReviewSchema, submitWeeklyReviewSignoffSchema, mealPlans, weeklyPlanDrafts, generateWeeklyPlanRequestSchema, updateWeeklyPlanDraftItemsSchema, plannerPromptSchema, type WeeklyPlanDraft, type Recipe } from "@shared/schema";
import { z } from "zod";
import { checkDatabaseHealth, db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
import authRouter from "./auth/routes";
import { apiRateLimit, familyCodeRateLimit, waitlistRateLimit, isAuthenticated, attachUser, getCurrentUser, requireCreatorRole, requireCommentatorRole, requireRole, requireFamilyEditAccess, commentatorRateLimit, weeklyPlanGenerateRateLimit } from "./auth/middleware";
import { generateInvitationCode, normalizeInvitationCode, isValidInvitationCodeFormat, isPastMealDate } from "@shared/utils";
import { allWeekSlots, computeEmptySlots, addDaysToDateString, validateDraftItemsForWeek, sanitizeDraftItemsForWeek } from "@shared/weekly-plan";
import { sendSignupNotification, sendWeekReviewNotification, sendReviewSignoffNotification } from "./email";

// Enriched weekly-plan-draft response shape shared by every draft endpoint:
// the raw draft row plus, per item, the recipe card data the client renders.
// `replaceWeek` is exposed as a real boolean (stored as 0/1); recipes deleted
// after generation come back as `recipe: null` (or `acompanamientoRecipe:
// null` for a deleted side) so the client can flag them.
function toDraftRecipeSummary(recipe: Recipe | undefined) {
  return recipe
    ? {
        id: recipe.id,
        nombre: recipe.nombre,
        categoria: recipe.categoria,
        calificacionNinos: recipe.calificacionNinos,
        esFavorita: recipe.esFavorita,
        tiempoPreparacion: recipe.tiempoPreparacion,
        imagen: recipe.imagen,
      }
    : null;
}

function buildEnrichedWeeklyPlanDraft(draft: WeeklyPlanDraft, recipesById: Map<number, Recipe>) {
  return {
    id: draft.id,
    weekStartDate: draft.weekStartDate,
    status: draft.status,
    replaceWeek: draft.replaceWeek === 1,
    instructions: draft.instructions,
    summary: draft.summary,
    model: draft.model,
    createdAt: draft.createdAt,
    items: draft.items.map((item) => ({
      fecha: item.fecha,
      tipoComida: item.tipoComida,
      recetaId: item.recetaId,
      razon: item.razon,
      acompanamientoId: item.acompanamientoId ?? null,
      recipe: toDraftRecipeSummary(recipesById.get(item.recetaId)),
      acompanamientoRecipe:
        item.acompanamientoId != null
          ? toDraftRecipeSummary(recipesById.get(item.acompanamientoId))
          : null,
    })),
  };
}

// Helper to parse cookies from request header (avoids adding cookie-parser dependency)
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...rest] = c.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    })
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Smart root: landing page for guests, redirect for authenticated users, health check for deployment
  app.get("/", async (req, res, next) => {
    // Authenticated users go to the app
    if (req.isAuthenticated()) {
      return res.redirect(302, "/app");
    }

    // Health check detection (deployment systems, curl, explicit query param)
    const isHealthCheck = req.headers['user-agent']?.includes('curl') ||
                         req.headers['user-agent']?.includes('health') ||
                         req.headers['accept']?.includes('application/json') ||
                         req.query.health === 'check';

    if (isHealthCheck) {
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

    // Unauthenticated browser request: serve the landing page with CSRF token
    const landingPath = path.resolve(import.meta.dirname, "landing.html");
    try {
      const html = await fs.promises.readFile(landingPath, "utf-8");
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false, // JS must read this to send it back as a header
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
      });
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      // If landing.html is missing, fall through to SPA
      next();
    }
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

  // CSRF validation middleware — runs before rate limiter so rejected
  // CSRF requests don't consume rate-limit slots
  const validateCsrf = (req: any, res: any, next: any) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies['csrf_token'];
    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: "Token CSRF inválido" });
    }
    next();
  };

  // Waitlist signup — public endpoint, CSRF-protected then rate-limited
  app.post("/api/waitlist", validateCsrf, waitlistRateLimit, async (req, res) => {
    try {
      const { email, source } = insertWaitlistSignupSchema.parse(req.body);

      const alreadySignedUp = await storage.isEmailOnWaitlist(email);
      if (alreadySignedUp) {
        // Return 200 (not 409) to prevent email enumeration
        return res.status(200).json({
          message: "¡Gracias! Te notificaremos cuando estemos listos."
        });
      }

      await storage.addWaitlistSignup(email, source);
      sendSignupNotification(email, source);
      res.status(201).json({
        message: "¡Gracias! Te notificaremos cuando estemos listos."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Email inválido" });
      }
      console.error("Waitlist signup error:", error);
      res.status(500).json({ error: "Error al procesar tu solicitud" });
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
      const { category, search, favorites, engaged } = req.query;
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      // Get user's families
      const userFamilies = await storage.getUserFamilies(userId);
      const familyId = userFamilies[0]?.id; // Single family per user // Single family per user constraint
      
      let recipes;
      
      // Start with all recipes or favorites for this user and family
      if (favorites === 'true') {
        recipes = await storage.getFavoriteRecipes(userId, familyId);
      } else {
        recipes = await storage.getAllRecipes(userId, familyId);
      }
      
      // Apply "has feedback" filter
      if (engaged === 'true') {
        if (!familyId) {
          return res.status(403).json({ error: "Debes pertenecer a una familia" });
        }
        const engagedIds = await storage.getRecipesWithFeedback(familyId);
        recipes = recipes.filter(recipe => engagedIds.has(recipe.id));
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

  // Engaged recipes (must be before :id to avoid Express matching "engaged" as an id)
  app.get("/api/recipes/engaged", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const isCommentator = user.role === "commentator";

      // Get all comments with recipeId already joined
      const allComments = await storage.getMealCommentsByFamily(familyId, isCommentator ? user.id : undefined);

      // Aggregate comments per recipe
      const recipeEngagement = new Map<number, { commentCount: number; latestComment: string }>();
      for (const comment of allComments) {
        const recipeId = comment.recipeId;
        if (!recipeId) continue;
        const existing = recipeEngagement.get(recipeId);
        if (existing) {
          existing.commentCount++;
          if (comment.createdAt.toISOString() > existing.latestComment) {
            existing.latestComment = comment.createdAt.toISOString();
          }
        } else {
          recipeEngagement.set(recipeId, {
            commentCount: 1,
            latestComment: comment.createdAt.toISOString(),
          });
        }
      }

      if (recipeEngagement.size === 0) {
        return res.json([]);
      }

      // Fetch the engaged recipes
      const allRecipes = await storage.getAllRecipes(undefined, familyId);
      const engagedRecipes = allRecipes
        .filter(r => recipeEngagement.has(r.id))
        .map(r => ({
          ...r,
          commentCount: recipeEngagement.get(r.id)!.commentCount,
          latestComment: recipeEngagement.get(r.id)!.latestComment,
        }))
        .sort((a, b) => b.commentCount - a.commentCount);

      res.json(engagedRecipes);
    } catch (error) {
      console.error("Error fetching engaged recipes:", error);
      res.status(500).json({ error: "Error al obtener las recetas con opiniones" });
    }
  });

  // Get all family ratings for a recipe (for display in recipe detail)
  app.get("/api/recipes/:id/ratings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) return res.status(400).json({ error: "ID inválido" });

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) return res.status(403).json({ error: "Debes pertenecer a una familia" });

      const [ratings, familyMembers] = await Promise.all([
        storage.getRecipeRatings(recipeId, familyId),
        storage.getFamilyMembers(familyId),
      ]);

      const userNameMap = new Map(familyMembers.map(m => [m.id, m.name]));
      const enriched = ratings.map(r => ({
        id: r.id,
        rating: r.rating,
        userName: userNameMap.get(r.userId) || "Usuario",
        createdAt: r.createdAt,
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching recipe ratings:", error);
      res.status(500).json({ error: "Error al obtener las calificaciones" });
    }
  });

  app.get("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      // Get user's families
      const userFamilies = await storage.getUserFamilies(userId);
      const familyId = userFamilies[0]?.id; // Single family per user // Single family per user constraint
      
      const recipe = await storage.getRecipeById(id, userId, familyId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener la receta" });
    }
  });

  app.post("/api/recipes", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const recipeData = insertRecipeSchema.parse(req.body);
      
      // Get user's primary family
      const userFamilies = await storage.getUserFamilies(user.id);
      const primaryFamily = userFamilies[0]; // Single family per user
      
      // Ensure the recipe belongs to the current user and family
      const recipeWithUser = { 
        ...recipeData, 
        userId: user.id,
        createdBy: user.id,
        familyId: primaryFamily?.id
      };
      const recipe = await storage.createRecipe(recipeWithUser);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de receta inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear la receta" });
    }
  });

  app.put("/api/recipes/:id", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;

      // Family-scoped ownership (same as GET /api/recipes/:id): many family
      // recipes have userId NULL (created by another member or by the AI
      // assistant), so scoping by userId alone made them un-editable (404).
      const userFamilies = userId ? await storage.getUserFamilies(userId) : [];
      const familyId = userFamilies[0]?.id; // Single family per user

      const updateData = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(id, updateData, userId, familyId);

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

  app.delete("/api/recipes/:id", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getCurrentUser(req);
      const userId = user?.id;

      // Family-scoped ownership — see PUT /api/recipes/:id above.
      const userFamilies = userId ? await storage.getUserFamilies(userId) : [];
      const familyId = userFamilies[0]?.id; // Single family per user

      // Check if recipe is used in the family's meal plans
      const isUsed = await storage.isRecipeUsedInMealPlans(id, userId, familyId);
      if (isUsed) {
        return res.status(400).json({
          error: "No se puede eliminar la receta porque está asignada a uno o más días de la semana. Primero elimine la receta de la planificación semanal."
        });
      }

      const deleted = await storage.deleteRecipe(id, userId, familyId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Receta no encontrada" });
      }
      
      res.json({ message: "Receta eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar la receta" });
    }
  });

  // Recipe assistant routes (LLM-powered initial inventory)
  const { suggestRecipes, refineRecipes, getRecipesForInsertion } = await import('./services/recipe-assistant');

  app.post("/api/recipes/suggest", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) return res.status(400).json({ error: "Debés pertenecer a una familia primero" });

      const { preferences } = req.body;
      if (!preferences || typeof preferences !== 'string') {
        return res.status(400).json({ error: "Describí tus preferencias para que pueda ayudarte" });
      }
      if (preferences.length > 2000) {
        return res.status(400).json({ error: "El texto es demasiado largo (máximo 2000 caracteres)" });
      }

      // Get existing recipe names for de-duplication
      const existingRecipes = await storage.getAllRecipes(user.id, familyId);
      const existingNames = existingRecipes.map(r => r.nombre);

      const result = await suggestRecipes(preferences, existingNames);
      res.json(result);
    } catch (error: any) {
      console.error("Recipe suggest error:", error);
      if (error.message?.includes('ANTHROPIC_API_KEY')) {
        return res.status(503).json({ error: "El servicio de IA no está configurado" });
      }
      res.status(500).json({ error: "Error al generar sugerencias de recetas" });
    }
  });

  app.post("/api/recipes/suggest/refine", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) return res.status(400).json({ error: "Debés pertenecer a una familia primero" });

      const { feedback, conversationHistory } = req.body;
      if (!feedback || typeof feedback !== 'string') {
        return res.status(400).json({ error: "Faltan datos para refinar la selección" });
      }
      if (feedback.length > 2000) {
        return res.status(400).json({ error: "El texto es demasiado largo (máximo 2000 caracteres)" });
      }

      const existingRecipes = await storage.getAllRecipes(user.id, familyId);
      const existingNames = existingRecipes.map(r => r.nombre);

      const result = await refineRecipes(feedback, conversationHistory, existingNames);
      res.json(result);
    } catch (error: any) {
      console.error("Recipe refine error:", error);
      res.status(500).json({ error: "Error al refinar las sugerencias" });
    }
  });

  app.post("/api/recipes/populate", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) return res.status(400).json({ error: "Debés pertenecer a una familia primero" });

      const { catalogIndices } = req.body;
      if (!Array.isArray(catalogIndices) || catalogIndices.length === 0) {
        return res.status(400).json({ error: "No se seleccionaron recetas para agregar" });
      }

      // De-duplicate against existing recipes one more time
      const existingRecipes = await storage.getAllRecipes(user.id, familyId);
      const existingNames = new Set(existingRecipes.map(r => r.nombre.toLowerCase()));

      const recipesToInsert = getRecipesForInsertion(catalogIndices, user.id, familyId)
        .filter(r => !existingNames.has(r.nombre.toLowerCase()));

      const created = [];
      for (const recipeData of recipesToInsert) {
        const recipe = await storage.createRecipe(recipeData);
        created.push(recipe);
      }

      res.status(201).json({
        message: `Se agregaron ${created.length} recetas a tu biblioteca`,
        count: created.length,
        recipes: created,
      });
    } catch (error) {
      console.error("Recipe populate error:", error);
      res.status(500).json({ error: "Error al agregar las recetas" });
    }
  });

  // Meal plan routes
  app.get("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const { startDate, date } = req.query;
      const user = getCurrentUser(req);
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      // Get user's families
      const userFamilies = await storage.getUserFamilies(userId);
      const familyId = userFamilies[0]?.id; // Single family per user // Single family per user constraint

      let mealPlans;
      if (startDate) {
        mealPlans = await storage.getMealPlansForWeek(startDate as string, userId, familyId);
      } else if (date) {
        mealPlans = await storage.getMealPlanByDate(date as string, userId, familyId);
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
        mealPlans = await storage.getMealPlansForWeek(formattedDate, userId, familyId);
      }

      res.json(mealPlans);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener el plan de comidas" });
    }
  });

  app.post("/api/meal-plans", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const mealPlanData = insertMealPlanSchema.parse(req.body);
      
      // Get user's primary family
      const userFamilies = await storage.getUserFamilies(user.id);
      const primaryFamily = userFamilies[0]; // Single family per user
      
      // Ensure the meal plan belongs to the current user and family
      const mealPlanWithUser = { 
        ...mealPlanData, 
        userId: user.id,
        createdBy: user.id,
        familyId: primaryFamily?.id
      };
      const mealPlan = await storage.createMealPlan(mealPlanWithUser);
      res.status(201).json(mealPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos del plan de comida inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al crear el plan de comida" });
    }
  });

  app.put("/api/meal-plans/:id", isAuthenticated, requireCreatorRole, async (req, res) => {
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

  app.delete("/api/meal-plans/:id", isAuthenticated, requireCreatorRole, async (req, res) => {
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

  // Weekly review lifecycle — admin submits the week's plan for family review
  app.get("/api/weekly-reviews", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const weekStartDate = req.query.weekStartDate;
      if (typeof weekStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
        return res.status(400).json({ error: "Parámetro weekStartDate inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const review = await storage.getWeeklyReviewWithSignoffs(familyId, weekStartDate);
      res.json(review ?? null);
    } catch (error) {
      console.error("Error fetching weekly review:", error);
      res.status(500).json({ error: "Error al obtener el estado de revisión" });
    }
  });

  app.post("/api/weekly-reviews", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const { weekStartDate } = submitWeeklyReviewSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const family = userFamilies[0];
      if (!family) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const review = await storage.submitWeeklyReview(family.id, weekStartDate, user.id);

      // Fire-and-forget email to Comensal (commentator) family members only.
      // Planificadores (creators) can submit/edit plans themselves, so the
      // review notification is targeted at the family members who only
      // comment and react.
      const members = await storage.getFamilyMembers(family.id);
      const recipients = members
        .filter((m) => m.id !== user.id && m.role === "commentator")
        .map((m) => ({
          email: m.email,
          name: m.name,
          notificationPreferences: m.notificationPreferences,
        }));

      if (recipients.length > 0) {
        sendWeekReviewNotification({
          familyName: family.nombre,
          weekStartDate,
          submitterName: user.name,
          recipients,
        });
      }

      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error submitting weekly review:", error);
      res.status(500).json({ error: "Error al enviar la semana para revisión" });
    }
  });

  // Commentator sign-off on a weekly review: "approved" or "changes_requested".
  // Notifies the creator (submitter) so they know the review is complete.
  app.post("/api/weekly-reviews/signoff", isAuthenticated, requireCommentatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const { weekStartDate, verdict, note } = submitWeeklyReviewSignoffSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const family = userFamilies[0];
      if (!family) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      let result;
      try {
        result = await storage.upsertWeeklyReviewSignoff(family.id, weekStartDate, user.id, verdict, note);
      } catch (err) {
        if (err instanceof Error && err.message === "WEEKLY_REVIEW_NOT_FOUND") {
          return res.status(404).json({ error: "La semana aún no fue enviada para revisión" });
        }
        throw err;
      }

      // Notify the submitter (creator) that the review is complete.
      const submitter = await storage.getFamilyMembers(family.id).then(
        (members) => members.find((m) => m.id === result.review.submittedBy)
      );

      if (submitter && submitter.id !== user.id) {
        sendReviewSignoffNotification({
          familyName: family.nombre,
          weekStartDate,
          reviewerName: user.name,
          verdict,
          note,
          recipient: {
            email: submitter.email,
            name: submitter.name,
            notificationPreferences: submitter.notificationPreferences,
          },
        });
      }

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error signing off weekly review:", error);
      res.status(500).json({ error: "Error al registrar la revisión" });
    }
  });

  // Intelligent weekly plan generator routes (AI drafts the week, the human
  // reviews/edits the draft and applying it writes real meal_plans rows)
  const {
    generateWeeklyPlan,
    buildRecipeLibraryEntries,
    planApplyOperations,
    mapAnthropicApiError,
    validateDraftItemsAgainstLibrary,
    buildSkippedSlotsResumenLine,
  } = await import('./services/weekly-plan-generator');

  app.post("/api/weekly-plan/generate", weeklyPlanGenerateRateLimit, isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const { weekStartDate, instructions, replaceWeek } = generateWeeklyPlanRequestSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const family = userFamilies[0]; // Single family per user
      if (!family) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const libraryRecipes = await storage.getAllRecipes(user.id, family.id);
      if (libraryRecipes.length === 0) {
        return res.status(400).json({ error: "Necesitás recetas en tu biblioteca para generar un plan." });
      }

      // Which slots does the AI have to fill?
      const weekEndDate = addDaysToDateString(weekStartDate, 6);
      const currentWeekPlans = await storage.getMealPlanHistoryRange(family.id, weekStartDate, weekEndDate);
      const slots = replaceWeek
        ? allWeekSlots(weekStartDate)
        : computeEmptySlots(weekStartDate, currentWeekPlans.map((plan) => ({ fecha: plan.fecha, tipoComida: plan.tipoComida })));
      if (slots.length === 0) {
        return res.status(400).json({ error: 'La semana ya está completa. Activá "Regenerar toda la semana" para reemplazarla.' });
      }

      // Family feedback context: 8 weeks of serving history plus the durable
      // preference signals (ratings, comments, proposals, review verdicts).
      const historyFrom = addDaysToDateString(weekStartDate, -56);
      const historyTo = addDaysToDateString(weekStartDate, -1);
      const [history, ratings, comments, proposals, recentReviews, currentReview] = await Promise.all([
        storage.getMealPlanHistoryRange(family.id, historyFrom, historyTo),
        storage.getRecipeRatingsByFamily(family.id),
        storage.getMealCommentsByFamily(family.id),
        storage.getMealProposalsByFamily(family.id),
        storage.getWeeklyReviewsRange(family.id, historyFrom, historyTo),
        storage.getWeeklyReviewWithSignoffs(family.id, weekStartDate),
      ]);

      const library = buildRecipeLibraryEntries({
        recipes: libraryRecipes.map((recipe) => ({
          id: recipe.id,
          nombre: recipe.nombre,
          categoria: recipe.categoria,
          calificacionNinos: recipe.calificacionNinos,
          esFavorita: recipe.esFavorita,
          tiempoPreparacion: recipe.tiempoPreparacion,
        })),
        ratings: ratings.map((rating) => ({ recipeId: rating.recipeId, rating: rating.rating })),
        history: history.map((plan) => ({ fecha: plan.fecha, tipoComida: plan.tipoComida, recetaId: plan.recetaId })),
        comments: comments.map((comment) => ({ recipeId: comment.recipeId, comment: comment.comment })),
        proposals: proposals.map((proposal) => ({
          proposedRecipeId: proposal.proposedRecipeId,
          status: proposal.status,
          reason: proposal.reason,
        })),
      });

      const generated = await generateWeeklyPlan({
        weekStartDate,
        slots,
        library,
        recentReviews: recentReviews.map((review) => ({ weekStartDate: review.weekStartDate, status: review.status })),
        signoffNotes: (currentReview?.signoffs ?? []).map((signoff) => ({
          userName: signoff.userName,
          verdict: signoff.verdict,
          note: signoff.note,
        })),
        plannerPrompt: family.plannerPrompt ?? null,
        instructions: instructions ?? null,
      });

      // Surface deliberately skipped slots to the reviewer: the skip line is
      // appended to the stored summary so the client renders it as plain text.
      const skippedLine = buildSkippedSlotsResumenLine(generated.skippedSlots);
      const summary = [generated.resumen, skippedLine]
        .filter((part): part is string => !!part)
        .join(' ');

      const draft = await storage.upsertWeeklyPlanDraft({
        familyId: family.id,
        weekStartDate,
        status: "pending",
        replaceWeek: replaceWeek ? 1 : 0,
        instructions,
        summary: summary || null,
        items: generated.items,
        model: generated.model,
        createdBy: user.id,
      });

      const recipesById = new Map(libraryRecipes.map((recipe) => [recipe.id, recipe]));
      res.json(buildEnrichedWeeklyPlanDraft(draft, recipesById));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Weekly plan generate error:", error);
      if (error?.message?.includes('ANTHROPIC_API_KEY')) {
        return res.status(503).json({ error: "El servicio de IA no está configurado" });
      }
      if (error?.message === 'GENERATION_INCOMPLETE') {
        return res.status(502).json({ error: "La IA no pudo generar un plan completo. Intentá de nuevo." });
      }
      const aiError = mapAnthropicApiError(error);
      if (aiError) {
        return res.status(aiError.status).json({ error: aiError.message });
      }
      res.status(500).json({ error: "Error al generar el plan semanal" });
    }
  });

  app.get("/api/weekly-plan/draft", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const weekStartDate = req.query.weekStartDate;
      if (typeof weekStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
        return res.status(400).json({ error: "Parámetro weekStartDate inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const draft = await storage.getWeeklyPlanDraft(familyId, weekStartDate);
      if (!draft || draft.status !== "pending") {
        return res.json(null);
      }

      const libraryRecipes = await storage.getAllRecipes(user.id, familyId);
      const recipesById = new Map(libraryRecipes.map((recipe) => [recipe.id, recipe]));
      res.json(buildEnrichedWeeklyPlanDraft(draft, recipesById));
    } catch (error) {
      console.error("Weekly plan draft fetch error:", error);
      res.status(500).json({ error: "Error al obtener el borrador del plan semanal" });
    }
  });

  app.put("/api/weekly-plan/draft/:id/items", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { items } = updateWeeklyPlanDraftItemsSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const existingDraft = await storage.getWeeklyPlanDraftById(id, familyId);
      if (!existingDraft || existingDraft.status !== "pending") {
        return res.status(404).json({ error: "Borrador no encontrado" });
      }

      // Every item must fall inside the draft's week and fill a distinct slot —
      // otherwise apply would write rows the review screen never showed.
      const weekError = validateDraftItemsForWeek(existingDraft.weekStartDate, items);
      if (weekError) {
        return res.status(400).json({ error: weekError });
      }

      // Revalidate every recetaId/acompanamientoId against the family library —
      // the client is never trusted to reference recipes outside the family,
      // an "Acompañamiento" can never stand alone as the meal, and a side must
      // actually be one. The Spanish message names the slot so the user can
      // find the stale item (e.g. a recipe deleted mid-draft).
      const libraryRecipes = await storage.getAllRecipes(user.id, familyId);
      const libraryCategories = new Map(libraryRecipes.map((recipe) => [recipe.id, recipe.categoria]));
      const validationError = validateDraftItemsAgainstLibrary(items, libraryCategories);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const draft = await storage.updateWeeklyPlanDraftItems(id, familyId, items);
      if (!draft) {
        return res.status(404).json({ error: "Borrador no encontrado" });
      }

      const recipesById = new Map(libraryRecipes.map((recipe) => [recipe.id, recipe]));
      res.json(buildEnrichedWeeklyPlanDraft(draft, recipesById));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Weekly plan draft items update error:", error);
      res.status(500).json({ error: "Error al actualizar el borrador del plan semanal" });
    }
  });

  app.post("/api/weekly-plan/draft/:id/apply", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const draft = await storage.getWeeklyPlanDraftById(id, familyId);
      if (!draft || draft.status !== "pending") {
        return res.status(404).json({ error: "Borrador no encontrado" });
      }

      const weekStartDate = draft.weekStartDate;
      const weekEndDate = addDaysToDateString(weekStartDate, 6);
      const replaceWeek = draft.replaceWeek === 1;

      // Defense in depth: apply exactly what the review screen shows — items
      // inside the week, one per slot (first wins). Anything else is dropped.
      const draftItems = sanitizeDraftItemsForWeek(weekStartDate, draft.items);

      // Revalidate the draft's recipes (mains AND sides): one may have been
      // deleted since generation (meal_plans has an FK to recipes, so a stale
      // id would make the insert fail with an opaque 500 instead of this
      // actionable 400).
      const libraryRecipes = await storage.getAllRecipes(user.id, familyId);
      const libraryIds = new Set(libraryRecipes.map((recipe) => recipe.id));
      const missingRecipeItem = draftItems.find((item) => !libraryIds.has(item.recetaId));
      if (missingRecipeItem) {
        return res.status(400).json({
          error: `La receta del ${missingRecipeItem.tipoComida} del ${missingRecipeItem.fecha} ya no está en tu biblioteca. Reemplazala o quitala antes de aplicar.`,
        });
      }
      const missingSideItem = draftItems.find(
        (item) => item.acompanamientoId != null && !libraryIds.has(item.acompanamientoId)
      );
      if (missingSideItem) {
        return res.status(400).json({
          error: `El acompañamiento del ${missingSideItem.tipoComida} del ${missingSideItem.fecha} ya no está en tu biblioteca. Reemplazá esa comida o quitala antes de aplicar.`,
        });
      }

      // All-or-nothing: the week re-read, the optional clear, the inserts and
      // the status flip run in a single transaction (drizzle's neon-serverless
      // Pool driver supports interactive transactions), so a crash mid-apply
      // can't leave a half-written week or a reusable draft.
      const result = await db.transaction(async (tx) => {
        const weekCondition = and(
          eq(mealPlans.familyId, familyId),
          gte(mealPlans.fecha, weekStartDate),
          lte(mealPlans.fecha, weekEndDate)
        );

        // Re-read the week inside the transaction: slots may have been filled
        // since the draft was generated.
        const occupied = replaceWeek
          ? []
          : await tx
              .select({ fecha: mealPlans.fecha, tipoComida: mealPlans.tipoComida })
              .from(mealPlans)
              .where(weekCondition);

        const operations = planApplyOperations(draftItems, occupied, replaceWeek);

        if (operations.clearWeekFirst) {
          await tx.delete(mealPlans).where(weekCondition);
        }

        if (operations.toInsert.length > 0) {
          await tx.insert(mealPlans).values(
            operations.toInsert.map((item) => ({
              fecha: item.fecha,
              tipoComida: item.tipoComida,
              recetaId: item.recetaId,
              userId: user.id,
              createdBy: user.id,
              familyId,
            }))
          );
        }

        const [applied] = await tx
          .update(weeklyPlanDrafts)
          .set({ status: "applied", updatedAt: new Date() })
          .where(and(
            eq(weeklyPlanDrafts.id, id),
            eq(weeklyPlanDrafts.familyId, familyId),
            eq(weeklyPlanDrafts.status, "pending")
          ))
          .returning();
        if (!applied) {
          // A concurrent apply/discard/regenerate won the race — roll back our writes
          throw new Error("WEEKLY_PLAN_DRAFT_NOT_FOUND");
        }

        return { applied: operations.toInsert.length, skipped: operations.skipped };
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "WEEKLY_PLAN_DRAFT_NOT_FOUND") {
        return res.status(404).json({ error: "Borrador no encontrado" });
      }
      console.error("Weekly plan apply error:", error);
      res.status(500).json({ error: "Error al aplicar el plan semanal" });
    }
  });

  app.post("/api/weekly-plan/draft/:id/discard", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const draft = await storage.updateWeeklyPlanDraftStatus(id, familyId, "discarded");
      if (!draft) {
        return res.status(404).json({ error: "Borrador no encontrado" });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Weekly plan discard error:", error);
      res.status(500).json({ error: "Error al descartar el borrador del plan semanal" });
    }
  });

  // Family planner profile — persistent context the AI planner always honors
  app.get("/api/family/planner-prompt", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const family = userFamilies[0];
      if (!family) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      res.json({ plannerPrompt: family.plannerPrompt ?? null });
    } catch (error) {
      console.error("Planner prompt fetch error:", error);
      res.status(500).json({ error: "Error al obtener el perfil del planificador" });
    }
  });

  app.patch("/api/family/planner-prompt", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const { plannerPrompt } = plannerPromptSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const family = userFamilies[0];
      if (!family) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // An empty (or blank) profile clears the stored prompt
      const updated = await storage.updateFamilyPlannerPrompt(
        family.id,
        plannerPrompt.trim() === "" ? null : plannerPrompt
      );
      if (!updated) {
        return res.status(404).json({ error: "Familia no encontrada" });
      }

      res.json({ plannerPrompt: updated.plannerPrompt });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Planner prompt update error:", error);
      res.status(500).json({ error: "Error al guardar el perfil del planificador" });
    }
  });

  // Family management endpoints
  
  // Create a new family
  app.post("/api/families", familyCodeRateLimit, isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const { nombre } = createFamilySchema.parse(req.body);
      
      // Generate unique invitation code with retry logic
      let codigoInvitacion = generateInvitationCode();
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const existingFamily = await storage.getFamilyByInviteCode(codigoInvitacion);
        if (!existingFamily) {
          break;
        }
        codigoInvitacion = generateInvitationCode();
        attempts++;
      }
      
      if (attempts === maxAttempts) {
        return res.status(500).json({ error: "No se pudo generar un código único" });
      }
      
      // Create family
      const family = await storage.createFamily({
        nombre,
        codigoInvitacion,
        createdBy: user.id
      });
      
      // Automatically add creator as first member
      await storage.addUserToFamily(family.id, user.id);
      
      res.status(201).json(family);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de familia inválidos", details: error.errors });
      }
      console.error("Error creating family:", error);
      res.status(500).json({ error: "Error al crear la familia" });
    }
  });
  
  // Get family details
  app.get("/api/families/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const familyId = parseInt(req.params.id);
      
      // Check if user belongs to this family
      const isMember = await storage.isUserInFamily(user.id, familyId);
      if (!isMember) {
        return res.status(403).json({ error: "No tienes acceso a esta familia" });
      }
      
      const family = await storage.getFamilyById(familyId);
      if (!family) {
        return res.status(404).json({ error: "Familia no encontrada" });
      }
      
      res.json(family);
    } catch (error) {
      console.error("Error fetching family:", error);
      res.status(500).json({ error: "Error al obtener la familia" });
    }
  });
  
  // Join family with invitation code — rate-limited to prevent code enumeration
  app.post("/api/families/join", familyCodeRateLimit, isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const { codigoInvitacion } = joinFamilySchema.parse(req.body);
      
      // Normalize and validate code format
      const normalizedCode = normalizeInvitationCode(codigoInvitacion);
      if (!isValidInvitationCodeFormat(normalizedCode)) {
        return res.status(400).json({ error: "Formato de código inválido" });
      }
      
      // Find family by invitation code
      const family = await storage.getFamilyByInviteCode(normalizedCode);
      if (!family) {
        return res.status(404).json({ error: "Código de invitación inválido" });
      }
      
      // Check if user is already a member
      const isAlreadyMember = await storage.isUserInFamily(user.id, family.id);
      if (isAlreadyMember) {
        return res.status(400).json({ error: "Ya eres miembro de esta familia" });
      }
      
      // Add user to family
      await storage.addUserToFamily(family.id, user.id);
      
      res.json({ 
        message: "Te has unido a la familia exitosamente",
        family: {
          id: family.id,
          nombre: family.nombre
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Código de invitación requerido", details: error.errors });
      }
      console.error("Error joining family:", error);
      res.status(500).json({ error: "Error al unirse a la familia" });
    }
  });
  
  // Get family members
  app.get("/api/families/:id/members", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const familyId = parseInt(req.params.id);
      
      // Check if user belongs to this family
      const isMember = await storage.isUserInFamily(user.id, familyId);
      if (!isMember) {
        return res.status(403).json({ error: "No tienes acceso a esta familia" });
      }
      
      const members = await storage.getFamilyMembers(familyId);
      
      // Get family details to identify the creator
      const family = await storage.getFamilyById(familyId);
      
      // Add role information to members
      const membersWithRoles = members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        role: member.id === family?.createdBy ? "admin" : "member",
        userRole: member.role,
        createdAt: member.createdAt
      }));
      
      res.json(membersWithRoles);
    } catch (error) {
      console.error("Error fetching family members:", error);
      res.status(500).json({ error: "Error al obtener los miembros de la familia" });
    }
  });
  
  // Remove family member (admin only)
  app.delete("/api/families/:id/members/:userId", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const familyId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      
      // Get family to check if current user is admin
      const family = await storage.getFamilyById(familyId);
      if (!family) {
        return res.status(404).json({ error: "Familia no encontrada" });
      }
      
      // Check if current user is admin (creator)
      if (user.id !== family.createdBy) {
        return res.status(403).json({ error: "Solo el administrador puede remover miembros" });
      }
      
      // Prevent admin from removing themselves
      if (user.id === targetUserId) {
        return res.status(400).json({ error: "No puedes removerte a ti mismo como administrador" });
      }
      
      // Check if target user is actually a member
      const isMember = await storage.isUserInFamily(targetUserId, familyId);
      if (!isMember) {
        return res.status(400).json({ error: "El usuario no es miembro de esta familia" });
      }
      
      // Remove user from family
      const removed = await storage.removeUserFromFamily(familyId, targetUserId);
      if (!removed) {
        return res.status(500).json({ error: "Error al remover el miembro" });
      }
      
      res.json({ message: "Miembro removido exitosamente" });
    } catch (error) {
      console.error("Error removing family member:", error);
      res.status(500).json({ error: "Error al remover el miembro de la familia" });
    }
  });
  
  // Leave family
  app.post("/api/families/:id/leave", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const familyId = parseInt(req.params.id);
      
      // Get family to check if user is admin
      const family = await storage.getFamilyById(familyId);
      if (!family) {
        return res.status(404).json({ error: "Familia no encontrada" });
      }
      
      // Prevent admin from leaving if there are other members
      if (user.id === family.createdBy) {
        const members = await storage.getFamilyMembers(familyId);
        if (members.length > 1) {
          return res.status(400).json({ 
            error: "Como administrador, no puedes abandonar la familia mientras tenga otros miembros. Transfiere la administración o remueve a los demás miembros primero." 
          });
        }
        
        // If admin is the only member, delete the entire family
        await storage.deleteFamily(familyId);
        return res.json({ message: "Has abandonado y eliminado la familia" });
      }
      
      // Check if user is actually a member
      const isMember = await storage.isUserInFamily(user.id, familyId);
      if (!isMember) {
        return res.status(400).json({ error: "No eres miembro de esta familia" });
      }
      
      // Remove user from family
      const removed = await storage.removeUserFromFamily(familyId, user.id);
      if (!removed) {
        return res.status(500).json({ error: "Error al abandonar la familia" });
      }
      
      res.json({ message: "Has abandonado la familia exitosamente" });
    } catch (error) {
      console.error("Error leaving family:", error);
      res.status(500).json({ error: "Error al abandonar la familia" });
    }
  });
  
  // Regenerate invitation code (admin only)
  app.post("/api/families/:id/regenerate-code", familyCodeRateLimit, isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const familyId = parseInt(req.params.id);
      
      // Get family to check if current user is admin
      const family = await storage.getFamilyById(familyId);
      if (!family) {
        return res.status(404).json({ error: "Familia no encontrada" });
      }
      
      // Check if current user is admin (creator)
      if (user.id !== family.createdBy) {
        return res.status(403).json({ error: "Solo el administrador puede regenerar códigos" });
      }
      
      // Generate new unique invitation code
      let newCode = generateInvitationCode();
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const existingFamily = await storage.getFamilyByInviteCode(newCode);
        if (!existingFamily || existingFamily.id === familyId) {
          break;
        }
        newCode = generateInvitationCode();
        attempts++;
      }
      
      if (attempts === maxAttempts) {
        return res.status(500).json({ error: "No se pudo generar un código único" });
      }
      
      // Update family with new code
      const updatedFamily = await storage.updateFamily(familyId, { 
        codigoInvitacion: newCode 
      });
      
      if (!updatedFamily) {
        return res.status(500).json({ error: "Error al actualizar el código" });
      }
      
      res.json({ 
        message: "Código de invitación regenerado exitosamente",
        codigoInvitacion: newCode
      });
    } catch (error) {
      console.error("Error regenerating invitation code:", error);
      res.status(500).json({ error: "Error al regenerar el código de invitación" });
    }
  });

  // Commentator-specific routes

  // Rate a recipe (commentators only)
  app.post("/api/recipes/:id/rating", isAuthenticated, commentatorRateLimit, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const recipeId = parseInt(req.params.id);
      const { rating } = req.body;

      // rating must be an integer 0-5 (0 = delete)
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) {
        return res.status(400).json({ error: "La calificación debe ser un número entero entre 0 y 5" });
      }

      // Get user's families to ensure they can access this recipe
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id; // Single family per user

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia para calificar recetas" });
      }

      // Verify recipe belongs to user's family
      const recipe = await storage.getRecipeById(recipeId, user.id, familyId);
      if (!recipe) {
        return res.status(404).json({ error: "Receta no encontrada o no tienes acceso" });
      }

      // rating=0 means clear the rating
      if (rating === 0) {
        await storage.deleteRecipeRating(recipeId, user.id);
        return res.json({
          message: "Calificación eliminada",
          rating: 0,
          recipeId: recipeId
        });
      }

      // Store the rating
      const result = await storage.setRecipeRating(recipeId, user.id, familyId, rating);

      res.json({
        message: "Calificación guardada exitosamente",
        rating: rating,
        recipeId: recipeId
      });
    } catch (error) {
      console.error("Error rating recipe:", error);
      res.status(500).json({ error: "Error al guardar la calificación" });
    }
  });

  // Get user's rating for a recipe
  app.get("/api/recipes/:id/rating", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const recipeId = parseInt(req.params.id);

      // Get user's rating for this recipe (returns RecipeRating object or undefined)
      const ratingRecord = await storage.getRecipeRating(recipeId, user.id);

      res.json({ rating: ratingRecord?.rating || 0 });
    } catch (error) {
      console.error("Error fetching recipe rating:", error);
      res.status(500).json({ error: "Error al obtener la calificación" });
    }
  });

  // Add comment to meal plan
  app.post("/api/meal-plans/:id/comment", isAuthenticated, commentatorRateLimit, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const mealPlanId = parseInt(req.params.id);
      if (isNaN(mealPlanId)) {
        return res.status(400).json({ error: "ID de plan de comida inválido" });
      }
      const { comment, emoji } = req.body;

      // Validate comment
      if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
        return res.status(400).json({ error: "El comentario es requerido" });
      }

      if (comment.length > 500) {
        return res.status(400).json({ error: "El comentario no puede exceder 500 caracteres" });
      }

      // Get user's families to ensure they can access this meal plan
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id; // Single family per user

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia para comentar" });
      }

      // Verify meal plan belongs to user's family (this will be implemented)
      const mealPlan = await storage.getMealPlanById(mealPlanId, user.id, familyId);
      if (!mealPlan) {
        return res.status(404).json({ error: "Plan de comida no encontrado o no tienes acceso" });
      }

      // Store the comment
      const result = await storage.addMealComment(mealPlanId, user.id, familyId, comment.trim(), emoji);

      // Auto-award the blue "left feedback" star for commenting
      try {
        await storage.createOrUpdateAchievement(
          mealPlanId,
          user.id,
          familyId,
          'left_feedback'
        );
      } catch (achievementError) {
        // Don't fail the comment if star award fails - just log it
        console.error("Error awarding feedback star:", achievementError);
      }

      res.status(201).json({
        message: "Comentario agregado exitosamente",
        comment: {
          id: result.id,
          comment: comment.trim(),
          emoji: emoji,
          userName: user.name,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error adding meal comment:", error);
      res.status(500).json({ error: "Error al agregar el comentario" });
    }
  });

  // Get comments for a meal plan
  app.get("/api/meal-plans/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const mealPlanId = parseInt(req.params.id);
      if (isNaN(mealPlanId)) {
        return res.status(400).json({ error: "ID de plan de comida inválido" });
      }

      // Get user's families to ensure they can access this meal plan
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id; // Single family per user

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Get comments for this meal plan, enriched with user names
      const [comments, familyMembers] = await Promise.all([
        storage.getMealComments(mealPlanId, familyId),
        storage.getFamilyMembers(familyId),
      ]);

      const userNameMap = new Map(familyMembers.map(m => [m.id, m.name]));
      const enrichedComments = comments.map(c => ({
        ...c,
        userName: userNameMap.get(c.userId) || "Usuario",
      }));

      res.json(enrichedComments);
    } catch (error) {
      console.error("Error fetching meal comments:", error);
      res.status(500).json({ error: "Error al obtener los comentarios" });
    }
  });

  // Get all comments for a recipe (across all meal plans)
  app.get("/api/recipes/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) {
        return res.status(400).json({ error: "ID de receta inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const [comments, familyMembers] = await Promise.all([
        storage.getRecipeComments(recipeId, familyId),
        storage.getFamilyMembers(familyId),
      ]);

      const userNameMap = new Map(familyMembers.map(m => [m.id, m.name]));
      const enrichedComments = comments.map(c => ({
        ...c,
        userName: userNameMap.get(c.userId) || "Usuario",
      }));

      res.json(enrichedComments);
    } catch (error) {
      console.error("Error fetching recipe comments:", error);
      res.status(500).json({ error: "Error al obtener los comentarios" });
    }
  });

  // Meal swap proposal routes — commentators propose, admin approves/rejects

  // List proposals for a meal plan (any family member)
  app.get("/api/meal-plans/:id/proposals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const mealPlanId = parseInt(req.params.id);
      if (isNaN(mealPlanId)) {
        return res.status(400).json({ error: "ID de plan de comida inválido" });
      }

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const mealPlan = await storage.getMealPlanById(mealPlanId, user.id, familyId);
      if (!mealPlan) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }

      const proposals = await storage.getMealProposals(mealPlanId, familyId);
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Error al obtener las propuestas" });
    }
  });

  // Create or replace a pending proposal (commentators only)
  app.post("/api/meal-plans/:id/proposals", isAuthenticated, commentatorRateLimit, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      if (user.role !== "commentator") {
        return res.status(403).json({ error: "Solo los miembros pueden proponer cambios" });
      }

      const mealPlanId = parseInt(req.params.id);
      if (isNaN(mealPlanId)) {
        return res.status(400).json({ error: "ID de plan de comida inválido" });
      }

      const { proposedRecipeId, reason } = createMealProposalSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      const mealPlan = await storage.getMealPlanById(mealPlanId, user.id, familyId);
      if (!mealPlan) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }

      // Block proposals on meals already in the past — they can't change history
      if (isPastMealDate(mealPlan.fecha)) {
        return res.status(400).json({ error: "No podés proponer cambios para comidas que ya pasaron" });
      }

      // Verify the proposed recipe is in the family's inventory
      const recipe = await storage.getRecipeById(proposedRecipeId, user.id, familyId);
      if (!recipe) {
        return res.status(404).json({ error: "Receta propuesta no encontrada" });
      }

      // Don't allow proposing the same recipe that's already in the meal plan
      if (mealPlan.recetaId === proposedRecipeId) {
        return res.status(400).json({ error: "Esa receta ya está en este día" });
      }

      const proposal = await storage.upsertMealProposal(
        mealPlanId,
        familyId,
        user.id,
        proposedRecipeId,
        reason
      );

      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de propuesta inválidos", details: error.errors });
      }
      console.error("Error creating proposal:", error);
      res.status(500).json({ error: "Error al crear la propuesta" });
    }
  });

  // Review a proposal (admin only) — accept mutates the meal plan
  app.patch("/api/meal-plans/:id/proposals/:proposalId", isAuthenticated, requireCreatorRole, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const mealPlanId = parseInt(req.params.id);
      const proposalId = parseInt(req.params.proposalId);
      if (isNaN(mealPlanId) || isNaN(proposalId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { status } = reviewMealProposalSchema.parse(req.body);

      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;
      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Verify the proposal belongs to the path's mealPlanId
      const existing = await storage.getProposalById(proposalId, familyId);
      if (!existing) {
        return res.status(404).json({ error: "Propuesta no encontrada" });
      }
      if (existing.mealPlanId !== mealPlanId) {
        return res.status(400).json({ error: "La propuesta no pertenece a este plan de comida" });
      }
      if (existing.status !== "pending") {
        return res.status(400).json({ error: "Esta propuesta ya fue revisada" });
      }

      const result = await storage.reviewMealProposal(proposalId, familyId, status, user.id);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error reviewing proposal:", error);
      res.status(500).json({ error: "Error al revisar la propuesta" });
    }
  });

  // Get recipes with engagement (comments/stars) for the favorites page
  // Meal Achievement Routes (Kids Gamification)

  // Award a star to a user for a meal
  app.post("/api/achievements", isAuthenticated, commentatorRateLimit, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      // Validate request body using Zod schema
      const { mealPlanId, starType } = req.body;

      if (!mealPlanId || !starType) {
        return res.status(400).json({ error: "mealPlanId y starType son requeridos" });
      }

      if (!['tried_it', 'ate_veggie', 'left_feedback'].includes(starType)) {
        return res.status(400).json({ error: "starType debe ser 'tried_it', 'ate_veggie', o 'left_feedback'" });
      }

      // Get user's families
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia para ganar estrellas" });
      }

      // Verify the meal plan belongs to the user's family
      const mealPlan = await db.select().from(mealPlans).where(eq(mealPlans.id, mealPlanId)).limit(1);

      if (!mealPlan || mealPlan.length === 0) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }

      if (mealPlan[0].familyId !== familyId) {
        return res.status(403).json({ error: "No tienes acceso a este plan de comida" });
      }

      // Create or update achievement
      const achievement = await storage.createOrUpdateAchievement(
        mealPlanId,
        user.id,
        familyId,
        starType as 'tried_it' | 'ate_veggie' | 'left_feedback'
      );

      // Map star type to friendly message
      const starMessages: Record<string, string> = {
        tried_it: "¡Ganaste una estrella dorada por probar la comida! 🌟",
        ate_veggie: "¡Ganaste una estrella verde por comer vegetales! 💚",
        left_feedback: "¡Ganaste una estrella azul por dejar comentarios! 💬"
      };

      res.status(201).json({
        message: starMessages[starType] || "¡Ganaste una estrella!",
        achievement
      });
    } catch (error) {
      console.error("Error awarding star:", error);
      res.status(500).json({ error: "Error al otorgar la estrella" });
    }
  });

  // Get achievements for a specific user
  app.get("/api/achievements/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const targetUserId = parseInt(req.params.userId);
      const { startDate, endDate } = req.query;

      // Get user's families
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Verify the target user is in the same family (or is the current user)
      const isSameFamily = await storage.isUserInFamily(targetUserId, familyId);

      if (!isSameFamily && targetUserId !== user.id) {
        return res.status(403).json({ error: "No tienes acceso a estos logros" });
      }

      // Get achievements
      const achievements = await storage.getUserAchievements(
        targetUserId,
        familyId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json(achievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ error: "Error al obtener los logros" });
    }
  });

  // Get all achievements for a specific meal (all family members)
  app.get("/api/achievements/meal/:mealPlanId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const mealPlanId = parseInt(req.params.mealPlanId);

      // Get user's families
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Verify the meal plan belongs to the user's family
      const mealPlan = await db.select().from(mealPlans).where(eq(mealPlans.id, mealPlanId)).limit(1);

      if (!mealPlan || mealPlan.length === 0) {
        return res.status(404).json({ error: "Plan de comida no encontrado" });
      }

      if (mealPlan[0].familyId !== familyId) {
        return res.status(403).json({ error: "No tienes acceso a este plan de comida" });
      }

      // Get achievements for this meal
      const achievements = await storage.getMealAchievements(mealPlanId, familyId);

      res.json(achievements);
    } catch (error) {
      console.error("Error fetching meal achievements:", error);
      res.status(500).json({ error: "Error al obtener los logros de la comida" });
    }
  });

  // Get stats for a specific user
  app.get("/api/achievements/stats/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const targetUserId = parseInt(req.params.userId);
      const { startDate } = req.query;

      // Get user's families
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Verify the target user is in the same family (or is the current user)
      const isSameFamily = await storage.isUserInFamily(targetUserId, familyId);

      if (!isSameFamily && targetUserId !== user.id) {
        return res.status(403).json({ error: "No tienes acceso a estas estadísticas" });
      }

      // Get stats
      const stats = await storage.getUserStats(
        targetUserId,
        familyId,
        startDate as string | undefined
      );

      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Error al obtener las estadísticas" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
