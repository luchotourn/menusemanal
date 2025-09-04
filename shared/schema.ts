import { pgTable, text, serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  name: text("name").notNull(),
  avatar: text("avatar"), // Base64 image or URL
  role: text("role").notNull().default("creator"), // "creator", "commentator"
  notificationPreferences: text("notification_preferences").default('{"email": true, "recipes": true, "mealPlans": true}'), // JSON string
  loginAttempts: integer("login_attempts").notNull().default(0),
  lastLoginAttempt: timestamp("last_login_attempt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index("users_email_idx").on(table.email),
  };
});

// Families table for multi-family support
export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  codigoInvitacion: text("codigo_invitacion").notNull().unique(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    codigoInvitacionIdx: uniqueIndex("families_codigo_invitacion_idx").on(table.codigoInvitacion),
  };
});

// Family members junction table
export const familyMembers = pgTable("family_members", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => {
  return {
    familyUserIdx: uniqueIndex("family_members_family_user_idx").on(table.familyId, table.userId),
    userIdx: index("family_members_user_idx").on(table.userId),
  };
});

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
  userId: integer("user_id").references(() => users.id), // Kept for backward compatibility
  createdBy: integer("created_by").references(() => users.id), // User who created the recipe
  familyId: integer("family_id").references(() => families.id), // Family this recipe belongs to
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    familyIdx: index("recipes_family_idx").on(table.familyId),
    createdByIdx: index("recipes_created_by_idx").on(table.createdBy),
  };
});

export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  fecha: text("fecha").notNull(), // YYYY-MM-DD format
  recetaId: integer("receta_id").references(() => recipes.id),
  tipoComida: text("tipo_comida").notNull().default("almuerzo"), // "almuerzo", "cena"
  notas: text("notas"),
  userId: integer("user_id").references(() => users.id), // Kept for backward compatibility
  createdBy: integer("created_by").references(() => users.id), // User who created the meal plan
  familyId: integer("family_id").references(() => families.id), // Family this meal plan belongs to
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    familyIdx: index("meal_plans_family_idx").on(table.familyId),
    fechaIdx: index("meal_plans_fecha_idx").on(table.fecha),
    familyFechaIdx: index("meal_plans_family_fecha_idx").on(table.familyId, table.fecha),
  };
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  recipes: many(recipes),
  mealPlans: many(mealPlans),
  familyMemberships: many(familyMembers),
  createdFamilies: many(families),
  createdRecipes: many(recipes),
  createdMealPlans: many(mealPlans),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  creator: one(users, {
    fields: [families.createdBy],
    references: [users.id],
  }),
  members: many(familyMembers),
  recipes: many(recipes),
  mealPlans: many(mealPlans),
}));

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ many, one }) => ({
  mealPlans: many(mealPlans),
  user: one(users, {
    fields: [recipes.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [recipes.createdBy],
    references: [users.id],
  }),
  family: one(families, {
    fields: [recipes.familyId],
    references: [families.id],
  }),
}));

export const mealPlansRelations = relations(mealPlans, ({ one }) => ({
  recipe: one(recipes, {
    fields: [mealPlans.recetaId],
    references: [recipes.id],
  }),
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [mealPlans.createdBy],
    references: [users.id],
  }),
  family: one(families, {
    fields: [mealPlans.familyId],
    references: [families.id],
  }),
}));

// Validation schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["creator", "commentator"]).default("creator"),
}).omit({
  id: true,
  loginAttempts: true,
  lastLoginAttempt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilySchema = createInsertSchema(families, {
  nombre: z.string().min(1, "El nombre de la familia es requerido").max(100, "El nombre es demasiado largo"),
  codigoInvitacion: z.string().min(6, "El código debe tener al menos 6 caracteres").max(20, "El código es demasiado largo"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  joinedAt: true,
});

export const joinFamilySchema = z.object({
  codigoInvitacion: z.string().min(1, "El código de invitación es requerido"),
});

export const createFamilySchema = z.object({
  nombre: z.string().min(1, "El nombre de la familia es requerido").max(100, "El nombre es demasiado largo"),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type Family = typeof families.$inferSelect;
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type JoinFamilyData = z.infer<typeof joinFamilySchema>;
export type CreateFamilyData = z.infer<typeof createFamilySchema>;

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
  }).default("creator"),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "Debes aceptar los términos y condiciones"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

// Profile management schemas
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre es demasiado largo"),
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido"),
  avatar: z.string().optional(),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    recipes: z.boolean().default(true),
    mealPlans: z.boolean().default(true),
  }).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "La contraseña actual es requerida"),
  newPassword: z
    .string()
    .min(1, "La nueva contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  confirmPassword: z.string().min(1, "Confirma la nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const avatarUploadSchema = z.object({
  avatar: z
    .string()
    .refine((data) => {
      if (!data) return true; // Optional field
      // Check if it's a valid base64 image or URL
      return data.startsWith('data:image/') || data.startsWith('http');
    }, "Avatar debe ser una imagen válida")
    .refine((data) => {
      if (!data || !data.startsWith('data:image/')) return true;
      // Check size limit for base64 images (1MB ~ 1.4MB in base64)
      return data.length <= 1400000;
    }, "La imagen es demasiado grande (máximo 1MB)"),
});

export const accountDeletionSchema = z.object({
  confirmationText: z
    .string()
    .refine((val) => val === "ELIMINAR", "Escribe 'ELIMINAR' para confirmar"),
  password: z
    .string()
    .min(1, "Ingresa tu contraseña para confirmar"),
});

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type AvatarUploadData = z.infer<typeof avatarUploadSchema>;
export type AccountDeletionData = z.infer<typeof accountDeletionSchema>;
