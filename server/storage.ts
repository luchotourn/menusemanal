import {
  recipes,
  mealPlans,
  families,
  familyMembers,
  users,
  recipeRatings,
  mealComments,
  type Recipe,
  type InsertRecipe,
  type MealPlan,
  type InsertMealPlan,
  type Family,
  type InsertFamily,
  type FamilyMember,
  type InsertFamilyMember,
  type User,
  type RecipeRating,
  type InsertRecipeRating,
  type MealComment,
  type InsertMealComment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, like, or, inArray, SQL } from "drizzle-orm";

export interface IStorage {
  // Recipe methods
  getAllRecipes(userId?: number, familyId?: number): Promise<Recipe[]>;
  getRecipeById(id: number, userId?: number, familyId?: number): Promise<Recipe | undefined>;
  getRecipesByCategory(categoria: string, userId?: number, familyId?: number): Promise<Recipe[]>;
  getFavoriteRecipes(userId?: number, familyId?: number): Promise<Recipe[]>;
  searchRecipes(query: string, userId?: number, familyId?: number): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>, userId?: number, familyId?: number): Promise<Recipe | undefined>;
  deleteRecipe(id: number, userId?: number, familyId?: number): Promise<boolean>;
  isRecipeUsedInMealPlans(recipeId: number, userId?: number, familyId?: number): Promise<boolean>;
  
  // Meal plan methods
  getMealPlansForWeek(startDate: string, userId?: number, familyId?: number): Promise<MealPlan[]>;
  getMealPlanByDate(fecha: string, userId?: number, familyId?: number): Promise<MealPlan[]>;
  getMealPlanByDateAndType(fecha: string, tipoComida: string, userId?: number, familyId?: number): Promise<MealPlan | undefined>;
  createMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan>;
  updateMealPlan(id: number, mealPlan: Partial<InsertMealPlan>, userId?: number, familyId?: number): Promise<MealPlan | undefined>;
  deleteMealPlan(id: number, userId?: number, familyId?: number): Promise<boolean>;
  
  // Family methods
  createFamily(family: InsertFamily): Promise<Family>;
  getFamilyById(id: number): Promise<Family | undefined>;
  getFamilyByInviteCode(code: string): Promise<Family | undefined>;
  getUserFamilies(userId: number): Promise<Family[]>;
  addUserToFamily(familyId: number, userId: number): Promise<FamilyMember>;
  removeUserFromFamily(familyId: number, userId: number): Promise<boolean>;
  getFamilyMembers(familyId: number): Promise<User[]>;
  isUserInFamily(userId: number, familyId: number): Promise<boolean>;
  updateFamily(id: number, family: Partial<InsertFamily>): Promise<Family | undefined>;
  deleteFamily(id: number): Promise<boolean>;

  // Recipe rating methods (commentator features)
  setRecipeRating(recipeId: number, userId: number, familyId: number, rating: number, comment?: string): Promise<RecipeRating>;
  getRecipeRating(recipeId: number, userId: number): Promise<RecipeRating | undefined>;
  getRecipeRatings(recipeId: number, familyId: number): Promise<RecipeRating[]>;
  getAverageRecipeRating(recipeId: number, familyId: number): Promise<number>;

  // Meal comment methods (commentator features)
  addMealComment(mealPlanId: number, userId: number, familyId: number, comment: string, emoji?: string): Promise<MealComment>;
  getMealComments(mealPlanId: number, familyId: number): Promise<MealComment[]>;
  deleteMealComment(commentId: number, userId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private recipes: Map<number, Recipe>;
  private mealPlans: Map<number, MealPlan>;
  private families: Map<number, Family>;
  private familyMembers: Map<number, FamilyMember>;
  private currentRecipeId: number;
  private currentMealPlanId: number;
  private currentFamilyId: number;
  private currentFamilyMemberId: number;

  constructor() {
    this.recipes = new Map();
    this.mealPlans = new Map();
    this.families = new Map();
    this.familyMembers = new Map();
    this.currentRecipeId = 1;
    this.currentMealPlanId = 1;
    this.currentFamilyId = 1;
    this.currentFamilyMemberId = 1;
  }

  // Recipe methods (Note: MemStorage ignores family filtering for simplicity)
  async getAllRecipes(userId?: number, familyId?: number): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async getRecipeById(id: number, userId?: number): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getRecipesByCategory(categoria: string, userId?: number): Promise<Recipe[]> {
    return Array.from(this.recipes.values()).filter(recipe => recipe.categoria === categoria);
  }

  async getFavoriteRecipes(userId?: number): Promise<Recipe[]> {
    return Array.from(this.recipes.values()).filter(recipe => recipe.esFavorita === 1);
  }

  async searchRecipes(query: string, userId?: number): Promise<Recipe[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.recipes.values()).filter(recipe => 
      recipe.nombre.toLowerCase().includes(lowercaseQuery) ||
      recipe.descripcion?.toLowerCase().includes(lowercaseQuery) ||
      recipe.categoria.toLowerCase().includes(lowercaseQuery) ||
      recipe.ingredientes?.some(ing => ing.toLowerCase().includes(lowercaseQuery))
    );
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const id = this.currentRecipeId++;
    const now = new Date();
    const recipe: Recipe = { 
      id,
      nombre: insertRecipe.nombre,
      descripcion: insertRecipe.descripcion || null,
      imagen: insertRecipe.imagen || null,
      enlaceExterno: insertRecipe.enlaceExterno || null,
      categoria: insertRecipe.categoria,
      calificacionNinos: insertRecipe.calificacionNinos || null,
      ingredientes: insertRecipe.ingredientes || null,
      instrucciones: insertRecipe.instrucciones || null,
      tiempoPreparacion: insertRecipe.tiempoPreparacion || null,
      porciones: insertRecipe.porciones || null,
      esFavorita: insertRecipe.esFavorita || null,
      userId: insertRecipe.userId || null,
      createdBy: insertRecipe.createdBy || null,
      familyId: insertRecipe.familyId || null,
      createdAt: now,
      updatedAt: now
    };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>, userId?: number): Promise<Recipe | undefined> {
    const existingRecipe = this.recipes.get(id);
    if (!existingRecipe) return undefined;
    
    const updatedRecipe: Recipe = { 
      ...existingRecipe, 
      ...updateData,
      descripcion: updateData.descripcion !== undefined ? updateData.descripcion || null : existingRecipe.descripcion,
      imagen: updateData.imagen !== undefined ? updateData.imagen || null : existingRecipe.imagen,
      enlaceExterno: updateData.enlaceExterno !== undefined ? updateData.enlaceExterno || null : existingRecipe.enlaceExterno,
      calificacionNinos: updateData.calificacionNinos !== undefined ? updateData.calificacionNinos || null : existingRecipe.calificacionNinos,
      ingredientes: updateData.ingredientes !== undefined ? updateData.ingredientes || null : existingRecipe.ingredientes,
      instrucciones: updateData.instrucciones !== undefined ? updateData.instrucciones || null : existingRecipe.instrucciones,
      tiempoPreparacion: updateData.tiempoPreparacion !== undefined ? updateData.tiempoPreparacion || null : existingRecipe.tiempoPreparacion,
      porciones: updateData.porciones !== undefined ? updateData.porciones || null : existingRecipe.porciones,
      esFavorita: updateData.esFavorita !== undefined ? updateData.esFavorita || null : existingRecipe.esFavorita
    };
    this.recipes.set(id, updatedRecipe);
    return updatedRecipe;
  }

  async deleteRecipe(id: number, userId?: number, familyId?: number): Promise<boolean> {
    return this.recipes.delete(id);
  }

  async isRecipeUsedInMealPlans(recipeId: number, userId?: number, familyId?: number): Promise<boolean> {
    const mealPlansArray = Array.from(this.mealPlans.values());
    for (const mealPlan of mealPlansArray) {
      if (mealPlan.recetaId === recipeId) {
        return true;
      }
    }
    return false;
  }

  // Meal plan methods
  async getMealPlansForWeek(startDate: string, userId?: number): Promise<MealPlan[]> {
    // Get meal plans for a week starting from startDate
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return Array.from(this.mealPlans.values()).filter(mealPlan => {
      const planDate = new Date(mealPlan.fecha);
      return planDate >= start && planDate <= end;
    });
  }

  async getMealPlanByDate(fecha: string, userId?: number): Promise<MealPlan[]> {
    return Array.from(this.mealPlans.values()).filter(mealPlan => mealPlan.fecha === fecha);
  }

  async getMealPlanByDateAndType(fecha: string, tipoComida: string, userId?: number): Promise<MealPlan | undefined> {
    return Array.from(this.mealPlans.values()).find(mealPlan => 
      mealPlan.fecha === fecha && mealPlan.tipoComida === tipoComida
    );
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const id = this.currentMealPlanId++;
    const now = new Date();
    const mealPlan: MealPlan = { 
      id,
      fecha: insertMealPlan.fecha,
      recetaId: insertMealPlan.recetaId || null,
      tipoComida: insertMealPlan.tipoComida || "almuerzo",
      notas: insertMealPlan.notas || null,
      userId: insertMealPlan.userId || null,
      createdBy: insertMealPlan.createdBy || null,
      familyId: insertMealPlan.familyId || null,
      createdAt: now,
      updatedAt: now
    };
    this.mealPlans.set(id, mealPlan);
    return mealPlan;
  }

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>, userId?: number): Promise<MealPlan | undefined> {
    const existingMealPlan = this.mealPlans.get(id);
    if (!existingMealPlan) return undefined;
    
    const updatedMealPlan: MealPlan = { 
      ...existingMealPlan, 
      ...updateData,
      recetaId: updateData.recetaId !== undefined ? updateData.recetaId || null : existingMealPlan.recetaId,
      tipoComida: updateData.tipoComida !== undefined ? updateData.tipoComida || "almuerzo" : existingMealPlan.tipoComida,
      notas: updateData.notas !== undefined ? updateData.notas || null : existingMealPlan.notas
    };
    this.mealPlans.set(id, updatedMealPlan);
    return updatedMealPlan;
  }

  async deleteMealPlan(id: number, userId?: number, familyId?: number): Promise<boolean> {
    return this.mealPlans.delete(id);
  }
  
  // Family management methods (stubbed for MemStorage)
  async createFamily(insertFamily: InsertFamily): Promise<Family> {
    const id = this.currentFamilyId++;
    const family: Family = { 
      id,
      nombre: insertFamily.nombre,
      codigoInvitacion: insertFamily.codigoInvitacion,
      createdBy: insertFamily.createdBy || null,
      createdAt: new Date()
    };
    this.families.set(id, family);
    return family;
  }
  
  async getFamilyById(id: number): Promise<Family | undefined> {
    return this.families.get(id);
  }
  
  async getFamilyByInviteCode(code: string): Promise<Family | undefined> {
    return Array.from(this.families.values()).find(f => f.codigoInvitacion === code);
  }
  
  async getUserFamilies(userId: number): Promise<Family[]> {
    // Simplified: return all families for MemStorage
    return Array.from(this.families.values());
  }
  
  async addUserToFamily(familyId: number, userId: number): Promise<FamilyMember> {
    const id = this.currentFamilyMemberId++;
    const member: FamilyMember = {
      id,
      familyId,
      userId,
      joinedAt: new Date()
    };
    this.familyMembers.set(id, member);
    return member;
  }
  
  async removeUserFromFamily(familyId: number, userId: number): Promise<boolean> {
    const memberEntry = Array.from(this.familyMembers.entries())
      .find(([_, member]) => member.familyId === familyId && member.userId === userId);
    
    if (memberEntry) {
      return this.familyMembers.delete(memberEntry[0]);
    }
    return false;
  }
  
  async getFamilyMembers(familyId: number): Promise<User[]> {
    // Simplified: return empty array for MemStorage
    return [];
  }
  
  async isUserInFamily(userId: number, familyId: number): Promise<boolean> {
    return Array.from(this.familyMembers.values())
      .some(member => member.userId === userId && member.familyId === familyId);
  }
  
  async updateFamily(id: number, updateData: Partial<InsertFamily>): Promise<Family | undefined> {
    const existing = this.families.get(id);
    if (!existing) return undefined;
    
    const updated: Family = { ...existing, ...updateData };
    this.families.set(id, updated);
    return updated;
  }
  
  async deleteFamily(id: number): Promise<boolean> {
    return this.families.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  // Helper method to build family-aware conditions
  private buildFamilyConditions(baseCondition: any, userId?: number, familyId?: number) {
    if (familyId) {
      return and(baseCondition, eq(recipes.familyId, familyId));
    }
    if (userId) {
      return and(baseCondition, eq(recipes.userId, userId));
    }
    return baseCondition;
  }
  
  private buildMealPlanFamilyConditions(baseCondition: any, userId?: number, familyId?: number) {
    if (familyId) {
      return and(baseCondition, eq(mealPlans.familyId, familyId));
    }
    if (userId) {
      return and(baseCondition, eq(mealPlans.userId, userId));
    }
    return baseCondition;
  }

  async getAllRecipes(userId?: number, familyId?: number): Promise<Recipe[]> {
    try {
      let conditions = undefined;
      
      if (familyId) {
        conditions = eq(recipes.familyId, familyId);
      } else if (userId) {
        conditions = eq(recipes.userId, userId);
      }
      
      const query = conditions 
        ? db.select().from(recipes).where(conditions)
        : db.select().from(recipes);
      
      return await query;
    } catch (error) {
      console.error('Database error in getAllRecipes:', error);
      throw new Error('Error al obtener las recetas de la base de datos');
    }
  }

  async getRecipeById(id: number, userId?: number, familyId?: number): Promise<Recipe | undefined> {
    const conditions = [eq(recipes.id, id)];
    
    if (familyId) {
      conditions.push(eq(recipes.familyId, familyId));
    } else if (userId) {
      conditions.push(eq(recipes.userId, userId));
    }
    
    const [recipe] = await db.select().from(recipes).where(and(...conditions));
    return recipe || undefined;
  }

  async getRecipesByCategory(categoria: string, userId?: number, familyId?: number): Promise<Recipe[]> {
    let conditions: SQL<unknown> = eq(recipes.categoria, categoria);

    if (familyId) {
      conditions = and(conditions, eq(recipes.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(recipes.userId, userId)) ?? conditions;
    }

    return await db.select().from(recipes).where(conditions);
  }

  async getFavoriteRecipes(userId?: number, familyId?: number): Promise<Recipe[]> {
    let conditions: SQL<unknown> = eq(recipes.esFavorita, 1);

    if (familyId) {
      conditions = and(conditions, eq(recipes.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(recipes.userId, userId)) ?? conditions;
    }
    
    return await db.select().from(recipes).where(conditions);
  }

  async searchRecipes(query: string, userId?: number, familyId?: number): Promise<Recipe[]> {
    const lowercaseQuery = `%${query.toLowerCase()}%`;
    const searchConditions = or(
      like(recipes.nombre, lowercaseQuery),
      like(recipes.descripcion, lowercaseQuery),
      like(recipes.categoria, lowercaseQuery)
    );
    
    let conditions = searchConditions;
    
    if (familyId) {
      conditions = and(searchConditions, eq(recipes.familyId, familyId));
    } else if (userId) {
      conditions = and(searchConditions, eq(recipes.userId, userId));
    }
    
    return await db.select().from(recipes).where(conditions);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values(insertRecipe)
      .returning();
    return recipe;
  }

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>, userId?: number, familyId?: number): Promise<Recipe | undefined> {
    let conditions = eq(recipes.id, id);
    
    if (familyId) {
      conditions = and(conditions, eq(recipes.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(recipes.userId, userId)) ?? conditions;
    }
    
    const [recipe] = await db
      .update(recipes)
      .set(updateData)
      .where(conditions)
      .returning();
    return recipe || undefined;
  }

  async deleteRecipe(id: number, userId?: number, familyId?: number): Promise<boolean> {
    try {
      let conditions = eq(recipes.id, id);
      
      if (familyId) {
        conditions = and(conditions, eq(recipes.familyId, familyId)) ?? conditions;
      } else if (userId) {
        conditions = and(conditions, eq(recipes.userId, userId)) ?? conditions;
      }
      
      const result = await db.delete(recipes).where(conditions);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Database error in deleteRecipe:', error);
      throw new Error('Error al eliminar la receta de la base de datos');
    }
  }

  async isRecipeUsedInMealPlans(recipeId: number, userId?: number, familyId?: number): Promise<boolean> {
    try {
      let conditions = eq(mealPlans.recetaId, recipeId);
      
      if (familyId) {
        conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
      } else if (userId) {
        conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
      }
      
      const result = await db.select().from(mealPlans).where(conditions).limit(1);
      return result.length > 0;
    } catch (error) {
      console.error('Database error in isRecipeUsedInMealPlans:', error);
      throw new Error('Error al verificar si la receta está en uso');
    }
  }

  async getMealPlansForWeek(startDate: string, userId?: number, familyId?: number): Promise<MealPlan[]> {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    // Format end date correctly in local timezone
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    const endDateStr = `${year}-${month}-${day}`;

    let conditions = and(
      gte(mealPlans.fecha, startDate),
      lte(mealPlans.fecha, endDateStr)
    );

    if (familyId) {
      conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
    }

    return await db.select({
      id: mealPlans.id,
      fecha: mealPlans.fecha,
      tipoComida: mealPlans.tipoComida,
      recetaId: mealPlans.recetaId,
      notas: mealPlans.notas,
      userId: mealPlans.userId,
      familyId: mealPlans.familyId,
      createdAt: mealPlans.createdAt,
      updatedAt: mealPlans.updatedAt,
      recipe: recipes
    })
    .from(mealPlans)
    .leftJoin(recipes, eq(mealPlans.recetaId, recipes.id))
    .where(conditions);
  }

  async getMealPlanByDate(fecha: string, userId?: number, familyId?: number): Promise<MealPlan[]> {
    let conditions = eq(mealPlans.fecha, fecha);
    
    if (familyId) {
      conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
    }
    
    return await db.select().from(mealPlans).where(conditions);
  }

  async getMealPlanByDateAndType(fecha: string, tipoComida: string, userId?: number, familyId?: number): Promise<MealPlan | undefined> {
    let conditions = and(
      eq(mealPlans.fecha, fecha),
      eq(mealPlans.tipoComida, tipoComida)
    );
    
    if (familyId) {
      conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
    }
    
    const [mealPlan] = await db.select().from(mealPlans).where(conditions);
    return mealPlan || undefined;
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const [mealPlan] = await db
      .insert(mealPlans)
      .values(insertMealPlan)
      .returning();
    return mealPlan;
  }

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>, userId?: number, familyId?: number): Promise<MealPlan | undefined> {
    let conditions = eq(mealPlans.id, id);
    
    if (familyId) {
      conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
    }
    
    const [mealPlan] = await db
      .update(mealPlans)
      .set(updateData)
      .where(conditions)
      .returning();
    return mealPlan || undefined;
  }

  async deleteMealPlan(id: number, userId?: number, familyId?: number): Promise<boolean> {
    let conditions = eq(mealPlans.id, id);
    
    if (familyId) {
      conditions = and(conditions, eq(mealPlans.familyId, familyId)) ?? conditions;
    } else if (userId) {
      conditions = and(conditions, eq(mealPlans.userId, userId)) ?? conditions;
    }
    
    const result = await db.delete(mealPlans).where(conditions);
    return (result.rowCount ?? 0) > 0;
  }
  
  // Family management methods
  async createFamily(insertFamily: InsertFamily): Promise<Family> {
    const [family] = await db
      .insert(families)
      .values(insertFamily)
      .returning();
    return family;
  }
  
  async getFamilyById(id: number): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.id, id));
    return family || undefined;
  }
  
  async getFamilyByInviteCode(code: string): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.codigoInvitacion, code));
    return family || undefined;
  }
  
  async getUserFamilies(userId: number): Promise<Family[]> {
    const memberFamilies = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));
    
    if (memberFamilies.length === 0) {
      return [];
    }
    
    const familyIds = memberFamilies.map(m => m.familyId);
    const result = await db
      .select()
      .from(families)
      .where(inArray(families.id, familyIds));
    
    return result;
  }
  
  async addUserToFamily(familyId: number, userId: number): Promise<FamilyMember> {
    const [member] = await db
      .insert(familyMembers)
      .values({ familyId, userId })
      .returning();
    return member;
  }
  
  async removeUserFromFamily(familyId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(familyMembers)
      .where(and(
        eq(familyMembers.familyId, familyId),
        eq(familyMembers.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getFamilyMembers(familyId: number): Promise<User[]> {
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
    
    if (members.length === 0) {
      return [];
    }
    
    const userIds = members.map(m => m.userId);
    const result = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    
    return result;
  }
  
  async isUserInFamily(userId: number, familyId: number): Promise<boolean> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      ))
      .limit(1);
    
    return !!member;
  }
  
  async updateFamily(id: number, updateData: Partial<InsertFamily>): Promise<Family | undefined> {
    const [family] = await db
      .update(families)
      .set(updateData)
      .where(eq(families.id, id))
      .returning();
    return family || undefined;
  }
  
  async deleteFamily(id: number): Promise<boolean> {
    // Note: Cascade delete will handle family_members, recipes, and meal_plans
    const result = await db.delete(families).where(eq(families.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Recipe rating methods (commentator features)
  async setRecipeRating(recipeId: number, userId: number, familyId: number, rating: number, comment?: string): Promise<RecipeRating> {
    // Check if rating already exists for this user and recipe
    const existingRating = await db
      .select()
      .from(recipeRatings)
      .where(and(
        eq(recipeRatings.recipeId, recipeId),
        eq(recipeRatings.userId, userId)
      ))
      .limit(1);

    if (existingRating.length > 0) {
      // Update existing rating
      const [updatedRating] = await db
        .update(recipeRatings)
        .set({
          rating,
          comment: comment || null,
          updatedAt: new Date()
        })
        .where(and(
          eq(recipeRatings.recipeId, recipeId),
          eq(recipeRatings.userId, userId)
        ))
        .returning();
      return updatedRating;
    } else {
      // Create new rating
      const [newRating] = await db
        .insert(recipeRatings)
        .values({
          recipeId,
          userId,
          familyId,
          rating,
          comment: comment || null
        })
        .returning();
      return newRating;
    }
  }

  async getRecipeRating(recipeId: number, userId: number): Promise<RecipeRating | undefined> {
    const [rating] = await db
      .select()
      .from(recipeRatings)
      .where(and(
        eq(recipeRatings.recipeId, recipeId),
        eq(recipeRatings.userId, userId)
      ))
      .limit(1);
    return rating || undefined;
  }

  async getRecipeRatings(recipeId: number, familyId: number): Promise<RecipeRating[]> {
    return await db
      .select()
      .from(recipeRatings)
      .where(and(
        eq(recipeRatings.recipeId, recipeId),
        eq(recipeRatings.familyId, familyId)
      ))
      .orderBy(recipeRatings.createdAt);
  }

  async getAverageRecipeRating(recipeId: number, familyId: number): Promise<number> {
    const ratings = await this.getRecipeRatings(recipeId, familyId);
    if (ratings.length === 0) return 0;

    const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    return Math.round((total / ratings.length) * 100) / 100; // Round to 2 decimal places
  }

  // Meal comment methods (commentator features)
  async addMealComment(mealPlanId: number, userId: number, familyId: number, comment: string, emoji?: string): Promise<MealComment> {
    const [newComment] = await db
      .insert(mealComments)
      .values({
        mealPlanId,
        userId,
        familyId,
        comment,
        emoji: emoji || null
      })
      .returning();
    return newComment;
  }

  async getMealComments(mealPlanId: number, familyId: number): Promise<MealComment[]> {
    return await db
      .select()
      .from(mealComments)
      .where(and(
        eq(mealComments.mealPlanId, mealPlanId),
        eq(mealComments.familyId, familyId)
      ))
      .orderBy(mealComments.createdAt);
  }

  async deleteMealComment(commentId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(mealComments)
      .where(and(
        eq(mealComments.id, commentId),
        eq(mealComments.userId, userId) // Ensure user can only delete their own comments
      ));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
