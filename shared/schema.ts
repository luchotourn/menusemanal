import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  imagen: text("imagen"), // URL or base64 image
  enlaceExterno: text("enlace_externo"),
  categoria: text("categoria").notNull(), // "Plato Principal", "Postre", "Merienda", etc.
  calificacionNinos: integer("calificacion_ninos").default(0), // 0-5 stars
  ingredientes: text("ingredientes").array(),
  instrucciones: text("instrucciones"),
  tiempoPreparacion: integer("tiempo_preparacion"), // minutes
  porciones: integer("porciones"),
  esFavorita: integer("es_favorita").default(0), // 0 or 1 as boolean
});

export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  fecha: text("fecha").notNull(), // YYYY-MM-DD format
  recetaId: integer("receta_id").references(() => recipes.id),
  tipoComida: text("tipo_comida").default("principal"), // "desayuno", "almuerzo", "cena", "merienda"
  notas: text("notas"),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
