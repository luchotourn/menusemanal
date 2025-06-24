import { recipes, mealPlans, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, like, or } from "drizzle-orm";

export interface IStorage {
  // Recipe methods
  getAllRecipes(): Promise<Recipe[]>;
  getRecipeById(id: number): Promise<Recipe | undefined>;
  getRecipesByCategory(categoria: string): Promise<Recipe[]>;
  getFavoriteRecipes(): Promise<Recipe[]>;
  searchRecipes(query: string): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number): Promise<boolean>;
  
  // Meal plan methods
  getMealPlansForWeek(startDate: string): Promise<MealPlan[]>;
  getMealPlanByDate(fecha: string): Promise<MealPlan[]>;
  getMealPlanByDateAndType(fecha: string, tipoComida: string): Promise<MealPlan | undefined>;
  createMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan>;
  updateMealPlan(id: number, mealPlan: Partial<InsertMealPlan>): Promise<MealPlan | undefined>;
  deleteMealPlan(id: number): Promise<boolean>;
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

  // Recipe methods
  async getAllRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async getRecipeById(id: number): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getRecipesByCategory(categoria: string): Promise<Recipe[]> {
    return Array.from(this.recipes.values()).filter(recipe => recipe.categoria === categoria);
  }

  async getFavoriteRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values()).filter(recipe => recipe.esFavorita === 1);
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
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

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>): Promise<Recipe | undefined> {
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

  async deleteRecipe(id: number): Promise<boolean> {
    return this.recipes.delete(id);
  }

  // Meal plan methods
  async getMealPlansForWeek(startDate: string): Promise<MealPlan[]> {
    // Get meal plans for a week starting from startDate
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return Array.from(this.mealPlans.values()).filter(mealPlan => {
      const planDate = new Date(mealPlan.fecha);
      return planDate >= start && planDate <= end;
    });
  }

  async getMealPlanByDate(fecha: string): Promise<MealPlan[]> {
    return Array.from(this.mealPlans.values()).filter(mealPlan => mealPlan.fecha === fecha);
  }

  async getMealPlanByDateAndType(fecha: string, tipoComida: string): Promise<MealPlan | undefined> {
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

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>): Promise<MealPlan | undefined> {
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

  async deleteMealPlan(id: number): Promise<boolean> {
    return this.mealPlans.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  async getAllRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes);
  }

  async getRecipeById(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe || undefined;
  }

  async getRecipesByCategory(categoria: string): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.categoria, categoria));
  }

  async getFavoriteRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.esFavorita, 1));
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    const lowercaseQuery = `%${query.toLowerCase()}%`;
    return await db.select().from(recipes).where(
      or(
        like(recipes.nombre, lowercaseQuery),
        like(recipes.descripcion, lowercaseQuery),
        like(recipes.categoria, lowercaseQuery)
      )
    );
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values(insertRecipe)
      .returning();
    return recipe;
  }

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const [recipe] = await db
      .update(recipes)
      .set(updateData)
      .where(eq(recipes.id, id))
      .returning();
    return recipe || undefined;
  }

  async deleteRecipe(id: number): Promise<boolean> {
    const result = await db.delete(recipes).where(eq(recipes.id, id));
    return result.rowCount > 0;
  }

  async getMealPlansForWeek(startDate: string): Promise<MealPlan[]> {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return await db.select().from(mealPlans).where(
      and(
        gte(mealPlans.fecha, startDate),
        lte(mealPlans.fecha, end.toISOString().split('T')[0])
      )
    );
  }

  async getMealPlanByDate(fecha: string): Promise<MealPlan[]> {
    return await db.select().from(mealPlans).where(eq(mealPlans.fecha, fecha));
  }

  async getMealPlanByDateAndType(fecha: string, tipoComida: string): Promise<MealPlan | undefined> {
    const [mealPlan] = await db.select().from(mealPlans).where(
      and(
        eq(mealPlans.fecha, fecha),
        eq(mealPlans.tipoComida, tipoComida)
      )
    );
    return mealPlan || undefined;
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const [mealPlan] = await db
      .insert(mealPlans)
      .values(insertMealPlan)
      .returning();
    return mealPlan;
  }

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>): Promise<MealPlan | undefined> {
    const [mealPlan] = await db
      .update(mealPlans)
      .set(updateData)
      .where(eq(mealPlans.id, id))
      .returning();
    return mealPlan || undefined;
  }

  async deleteMealPlan(id: number): Promise<boolean> {
    const result = await db.delete(mealPlans).where(eq(mealPlans.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
