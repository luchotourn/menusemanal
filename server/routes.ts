import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema, createFamilySchema, joinFamilySchema, mealPlans } from "@shared/schema";
import { z } from "zod";
import { checkDatabaseHealth, db } from "./db";
import { eq } from "drizzle-orm";
import authRouter from "./auth/routes";
import { apiRateLimit, familyCodeRateLimit, isAuthenticated, attachUser, getCurrentUser, requireCreatorRole, requireRole, requireFamilyEditAccess, commentatorRateLimit } from "./auth/middleware";
import { generateInvitationCode, normalizeInvitationCode, isValidInvitationCodeFormat } from "@shared/utils";

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

  app.delete("/api/recipes/:id", isAuthenticated, requireCreatorRole, async (req, res) => {
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
  
  // Join family with invitation code
  app.post("/api/families/join", isAuthenticated, async (req, res) => {
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

      // Validate rating (1-5 stars)
      if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({ error: "La calificación debe ser un número entero entre 1 y 5" });
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

      // Store the rating (this will be implemented in storage layer)
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

      // Get user's rating for this recipe
      const rating = await storage.getRecipeRating(recipeId, user.id);

      res.json({ rating: rating || 0 });
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
      const result = await storage.addMealComment(mealPlanId, user.id, comment.trim(), emoji);

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

      // Get user's families to ensure they can access this meal plan
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id; // Single family per user

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia" });
      }

      // Get comments for this meal plan
      const comments = await storage.getMealComments(mealPlanId, familyId);

      res.json(comments);
    } catch (error) {
      console.error("Error fetching meal comments:", error);
      res.status(500).json({ error: "Error al obtener los comentarios" });
    }
  });

  // Get family comments feed (aggregated)
  app.get("/api/comments/family", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      // Get user's family
      const userFamilies = await storage.getUserFamilies(user.id);
      const familyId = userFamilies[0]?.id;

      if (!familyId) {
        return res.status(403).json({ error: "Debes pertenecer a una familia para ver comentarios" });
      }

      // Optional limit parameter (default 50, max 100)
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      // Get aggregated comments for the family
      const comments = await storage.getFamilyComments(familyId, limit);

      res.json(comments);
    } catch (error) {
      console.error("Error fetching family comments:", error);
      res.status(500).json({ error: "Error al obtener los comentarios de la familia" });
    }
  });

  // Delete a meal comment (users can only delete their own)
  app.delete("/api/meal-plans/:mealPlanId/comments/:commentId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const commentId = parseInt(req.params.commentId);

      // Delete comment (storage method ensures user can only delete their own)
      const deleted = await storage.deleteMealComment(commentId, user.id);

      if (!deleted) {
        return res.status(404).json({ error: "Comentario no encontrado o no tienes permiso para eliminarlo" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meal comment:", error);
      res.status(500).json({ error: "Error al eliminar el comentario" });
    }
  });

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
