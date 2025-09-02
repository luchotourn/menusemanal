import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  imagen: text("imagen"), // URL or base64 image
  enlaceExterno: text("enlace_externo"),
  categoria: text("categoria").notNull(), // "Plato Principal", "Acompañamiento", "Entrada", "Ensalada", "Sopa"
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
  tipoComida: text("tipo_comida").notNull().default("almuerzo"), // "almuerzo", "cena"
  notas: text("notas"),
});

export const recipesRelations = relations(recipes, ({ many }) => ({
  mealPlans: many(mealPlans),
}));

export const mealPlansRelations = relations(mealPlans, ({ one }) => ({
  recipe: one(recipes, {
    fields: [mealPlans.recetaId],
    references: [recipes.id],
  }),
}));

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

// Authentication schemas
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(1, "El nombre completo es requerido")
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre es demasiado largo"),
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  role: z.enum(["creator", "commentator"], {
    required_error: "Selecciona un rol",
  }),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "Debes aceptar los términos y condiciones"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
