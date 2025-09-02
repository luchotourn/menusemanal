import { recipes, mealPlans, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, like, or } from "drizzle-orm";

export interface IStorage {
  // Recipe methods
  getAllRecipes(userId?: number): Promise<Recipe[]>;
  getRecipeById(id: number, userId?: number): Promise<Recipe | undefined>;
  getRecipesByCategory(categoria: string, userId?: number): Promise<Recipe[]>;
  getFavoriteRecipes(userId?: number): Promise<Recipe[]>;
  searchRecipes(query: string, userId?: number): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>, userId?: number): Promise<Recipe | undefined>;
  deleteRecipe(id: number, userId?: number): Promise<boolean>;
  isRecipeUsedInMealPlans(recipeId: number, userId?: number): Promise<boolean>;
  
  // Meal plan methods
  getMealPlansForWeek(startDate: string, userId?: number): Promise<MealPlan[]>;
  getMealPlanByDate(fecha: string, userId?: number): Promise<MealPlan[]>;
  getMealPlanByDateAndType(fecha: string, tipoComida: string, userId?: number): Promise<MealPlan | undefined>;
  createMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan>;
  updateMealPlan(id: number, mealPlan: Partial<InsertMealPlan>, userId?: number): Promise<MealPlan | undefined>;
  deleteMealPlan(id: number, userId?: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private recipes: Map<number, Recipe>;
  private mealPlans: Map<number, MealPlan>;
  private currentRecipeId: number;
  private currentMealPlanId: number;

  constructor() {
    this.recipes = new Map();
    this.mealPlans = new Map();
    this.currentRecipeId = 1;
    this.currentMealPlanId = 1;
  }

  // Recipe methods (Note: MemStorage ignores userId for simplicity)
  async getAllRecipes(userId?: number): Promise<Recipe[]> {
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
    const recipe: Recipe = { 
      ...insertRecipe, 
      id,
      descripcion: insertRecipe.descripcion || null,
      imagen: insertRecipe.imagen || null,
      enlaceExterno: insertRecipe.enlaceExterno || null,
      calificacionNinos: insertRecipe.calificacionNinos || null,
      ingredientes: insertRecipe.ingredientes || null,
      instrucciones: insertRecipe.instrucciones || null,
      tiempoPreparacion: insertRecipe.tiempoPreparacion || null,
      porciones: insertRecipe.porciones || null,
      esFavorita: insertRecipe.esFavorita || null
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

  async deleteRecipe(id: number, userId?: number): Promise<boolean> {
    return this.recipes.delete(id);
  }

  async isRecipeUsedInMealPlans(recipeId: number, userId?: number): Promise<boolean> {
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
    const mealPlan: MealPlan = { 
      ...insertMealPlan, 
      id,
      recetaId: insertMealPlan.recetaId || null,
      tipoComida: insertMealPlan.tipoComida || "almuerzo",
      notas: insertMealPlan.notas || null
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

  async deleteMealPlan(id: number, userId?: number): Promise<boolean> {
    return this.mealPlans.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  async getAllRecipes(userId?: number): Promise<Recipe[]> {
    try {
      let query = db.select().from(recipes);
      
      if (userId) {
        query = query.where(eq(recipes.userId, userId));
      }
      
      return await query;
    } catch (error) {
      console.error('Database error in getAllRecipes:', error);
      throw new Error('Error al obtener las recetas de la base de datos');
    }
  }

  async getRecipeById(id: number, userId?: number): Promise<Recipe | undefined> {
    const conditions = userId 
      ? and(eq(recipes.id, id), eq(recipes.userId, userId))
      : eq(recipes.id, id);
    
    const [recipe] = await db.select().from(recipes).where(conditions);
    return recipe || undefined;
  }

  async getRecipesByCategory(categoria: string, userId?: number): Promise<Recipe[]> {
    const conditions = userId 
      ? and(eq(recipes.categoria, categoria), eq(recipes.userId, userId))
      : eq(recipes.categoria, categoria);
    
    return await db.select().from(recipes).where(conditions);
  }

  async getFavoriteRecipes(userId?: number): Promise<Recipe[]> {
    const conditions = userId 
      ? and(eq(recipes.esFavorita, 1), eq(recipes.userId, userId))
      : eq(recipes.esFavorita, 1);
    
    return await db.select().from(recipes).where(conditions);
  }

  async searchRecipes(query: string, userId?: number): Promise<Recipe[]> {
    const lowercaseQuery = `%${query.toLowerCase()}%`;
    const searchConditions = or(
      like(recipes.nombre, lowercaseQuery),
      like(recipes.descripcion, lowercaseQuery),
      like(recipes.categoria, lowercaseQuery)
    );
    
    const conditions = userId 
      ? and(searchConditions, eq(recipes.userId, userId))
      : searchConditions;
    
    return await db.select().from(recipes).where(conditions);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values(insertRecipe)
      .returning();
    return recipe;
  }

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>, userId?: number): Promise<Recipe | undefined> {
    const conditions = userId 
      ? and(eq(recipes.id, id), eq(recipes.userId, userId))
      : eq(recipes.id, id);
    
    const [recipe] = await db
      .update(recipes)
      .set(updateData)
      .where(conditions)
      .returning();
    return recipe || undefined;
  }

  async deleteRecipe(id: number, userId?: number): Promise<boolean> {
    try {
      const conditions = userId 
        ? and(eq(recipes.id, id), eq(recipes.userId, userId))
        : eq(recipes.id, id);
      
      const result = await db.delete(recipes).where(conditions);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Database error in deleteRecipe:', error);
      throw new Error('Error al eliminar la receta de la base de datos');
    }
  }

  async isRecipeUsedInMealPlans(recipeId: number, userId?: number): Promise<boolean> {
    try {
      const conditions = userId 
        ? and(eq(mealPlans.recetaId, recipeId), eq(mealPlans.userId, userId))
        : eq(mealPlans.recetaId, recipeId);
      
      const result = await db.select().from(mealPlans).where(conditions).limit(1);
      return result.length > 0;
    } catch (error) {
      console.error('Database error in isRecipeUsedInMealPlans:', error);
      throw new Error('Error al verificar si la receta está en uso');
    }
  }

  async getMealPlansForWeek(startDate: string, userId?: number): Promise<MealPlan[]> {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    // Format end date correctly in local timezone
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    const endDateStr = `${year}-${month}-${day}`;
    
    const dateRange = and(
      gte(mealPlans.fecha, startDate),
      lte(mealPlans.fecha, endDateStr)
    );
    
    const conditions = userId 
      ? and(dateRange, eq(mealPlans.userId, userId))
      : dateRange;
    
    return await db.select().from(mealPlans).where(conditions);
  }

  async getMealPlanByDate(fecha: string, userId?: number): Promise<MealPlan[]> {
    const conditions = userId 
      ? and(eq(mealPlans.fecha, fecha), eq(mealPlans.userId, userId))
      : eq(mealPlans.fecha, fecha);
    
    return await db.select().from(mealPlans).where(conditions);
  }

  async getMealPlanByDateAndType(fecha: string, tipoComida: string, userId?: number): Promise<MealPlan | undefined> {
    const baseConditions = and(
      eq(mealPlans.fecha, fecha),
      eq(mealPlans.tipoComida, tipoComida)
    );
    
    const conditions = userId 
      ? and(baseConditions, eq(mealPlans.userId, userId))
      : baseConditions;
    
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

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>, userId?: number): Promise<MealPlan | undefined> {
    const conditions = userId 
      ? and(eq(mealPlans.id, id), eq(mealPlans.userId, userId))
      : eq(mealPlans.id, id);
    
    const [mealPlan] = await db
      .update(mealPlans)
      .set(updateData)
      .where(conditions)
      .returning();
    return mealPlan || undefined;
  }

  async deleteMealPlan(id: number, userId?: number): Promise<boolean> {
    const conditions = userId 
      ? and(eq(mealPlans.id, id), eq(mealPlans.userId, userId))
      : eq(mealPlans.id, id);
    
    const result = await db.delete(mealPlans).where(conditions);
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
