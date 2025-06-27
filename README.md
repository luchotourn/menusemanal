# 🍽️ Menu Familiar

**Planificación de comidas familiares que realmente funciona.**

Una PWA ultrarrápida y mobile-first para familias que quieren dejar de preguntar "¿Qué comemos hoy?" todos los días.

## Stack

```
Frontend  → React 18 + TypeScript + Tailwind + shadcn/ui
Backend   → Express.js + Drizzle ORM + PostgreSQL  
Database  → Neon Serverless PostgreSQL
Deploy    → Replit (porque simplemente funciona™)
```

## Funcionalidades

- **Planificación Semanal** - Arrastrá recetas al calendario, listo
- **Gestor de Recetas** - CRUD con categorías, búsqueda, ratings para chicos
- **PWA Mobile** - Instalala, usala offline
- **Kid-Friendly** - Sistema de 5 estrellas (porque los chicos son honestos)
- **Localizado** - UX enfocado en Argentina

## Inicio Rápido

```bash
# Clonar e instalar
git clone https://github.com/luchotourn/menusemanal.git
cd menusemanal
npm install

# Configurar base de datos
cp .env.example .env
# Agregar tu DATABASE_URL (recomendamos Neon)
npm run db:push

# Servidor de desarrollo
npm run dev
```

**Producción:** `npm run build && npm start`


**Schema de Base de Datos:**
- `recipes` - Nombre, ingredientes, instrucciones, categorías, rating_chicos
- `meal_plans` - Asignaciones de recetas por fecha/tipo_comida

**Endpoints API:**
- `GET/POST /api/recipes` - CRUD recetas + búsqueda/filtros
- `GET/POST /api/meal-plans` - Planificación semanal

## Contribuir

¿Encontraste un bug? Abrí un issue. ¿Querés contribuir? Fork y PR.

---

*Construido con ☕ y la eterna pregunta: "¿Qué comemos hoy?"*
