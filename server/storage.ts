import { recipes, mealPlans, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan } from "@shared/schema";

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
    const recipe: Recipe = { ...insertRecipe, id };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async updateRecipe(id: number, updateData: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const existingRecipe = this.recipes.get(id);
    if (!existingRecipe) return undefined;
    
    const updatedRecipe: Recipe = { ...existingRecipe, ...updateData };
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

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const id = this.currentMealPlanId++;
    const mealPlan: MealPlan = { ...insertMealPlan, id };
    this.mealPlans.set(id, mealPlan);
    return mealPlan;
  }

  async updateMealPlan(id: number, updateData: Partial<InsertMealPlan>): Promise<MealPlan | undefined> {
    const existingMealPlan = this.mealPlans.get(id);
    if (!existingMealPlan) return undefined;
    
    const updatedMealPlan: MealPlan = { ...existingMealPlan, ...updateData };
    this.mealPlans.set(id, updatedMealPlan);
    return updatedMealPlan;
  }

  async deleteMealPlan(id: number): Promise<boolean> {
    return this.mealPlans.delete(id);
  }
}

export const storage = new MemStorage();
