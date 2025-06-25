# Family Meal Planner Application

## Overview

This is a family meal planning application built with React (frontend) and Express.js (backend), designed to help families organize their weekly meals, manage recipes, and track favorite dishes with kid-friendly ratings. The app features a mobile-first design with a clean, intuitive interface optimized for family use.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Build Tool**: Vite for development and building
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **API Design**: RESTful endpoints for recipes and meal plans
- **Development**: Hot reload with Vite middleware integration

### Data Storage Solutions
- **Primary Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Fallback Storage**: In-memory storage implementation for development

## Key Components

### Database Schema
- **recipes**: Stores recipe information including name, description, ingredients, instructions, categories, kid ratings, and favorite status
- **meal_plans**: Links recipes to specific dates and meal types for weekly planning

### API Endpoints
- **Recipe Management**: CRUD operations for recipes with filtering by category, favorites, and search
- **Meal Planning**: Weekly meal plan management with date-based queries
- **Categories**: Support for multiple meal categories (breakfast, lunch, dinner, snacks, etc.)

### UI Components
- **Bottom Navigation**: Mobile-first navigation with Home, Recipes, Favorites, and Settings
- **Recipe Cards**: Compact display with images, ratings, and quick actions
- **Weekly Calendar**: Visual meal planning interface with date navigation
- **Modal System**: Full-screen modals for recipe details and adding/editing recipes

## Data Flow

1. **Recipe Management**: Users can create, edit, and delete recipes through modal interfaces
2. **Meal Planning**: Recipes are assigned to specific dates and meal types via the weekly calendar
3. **Favorites System**: Recipes can be marked as favorites and filtered accordingly
4. **Search and Filter**: Real-time search and category filtering for recipe discovery
5. **Kid Ratings**: 5-star rating system specifically for tracking how much kids like each recipe

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React, Wouter for routing
- **Styling**: Tailwind CSS, Radix UI components, shadcn/ui
- **State Management**: TanStack Query for server state
- **Form Handling**: React Hook Form with Zodschema validation
- **Utilities**: clsx, class-variance-authority, date-fns

### Backend Dependencies
- **Database**: Drizzle ORM, Neon serverless PostgreSQL driver
- **Validation**: Zod for schema validation
- **Development**: tsx for TypeScript execution, esbuild for production builds

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express.js backend
- **Database**: Neon serverless PostgreSQL with connection pooling
- **Hot Reload**: Vite middleware integration for seamless development

### Production Deployment
- **Platform**: Replit with autoscale deployment target
- **Build Process**: Vite build for frontend, esbuild for backend bundling
- **Database**: Neon serverless PostgreSQL for production
- **Port Configuration**: Port 5000 mapped to external port 80

### Environment Configuration
- **Database**: Requires DATABASE_URL environment variable
- **Node.js**: Version 20 with ESM modules
- **PostgreSQL**: Version 16 for development compatibility

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 25, 2025: Fixed duplicate meal addition bug caused by double click handlers in meal selection modal
- June 25, 2025: Added support for multiple meals per day/time slot - users can now add multiple dishes for the same meal
- June 25, 2025: Improved long press gesture by preventing text selection and context menus for better mobile experience
- June 24, 2025: Updated PWA icon to new transparent centered fork/knife design
- June 24, 2025: Fixed mobile deletion UI with long press gestures and confirmation dialog for meal plan items
- June 24, 2025: Updated PWA icon and app name to "Menu Familiar" with custom fork/knife icon
- June 24, 2025: Added mobile app icons and PWA manifest for proper mobile installation
- June 24, 2025: Fixed duplicate close buttons in edit recipe modal
- June 24, 2025: Added delete recipe functionality with validation to prevent deletion of recipes assigned to meal plans
- June 24, 2025: Removed file upload functionality from recipes - now only supports URL-based images
- June 24, 2025: Fixed broken image icons in home page weekly calendar by adding proper validation
- June 24, 2025: Changed "add image" to "add file" for general document support (images, PDFs, documents)
- June 24, 2025: Fixed edit recipe functionality and added proper "Agregar a la semana" workflow with date/meal selection
- June 24, 2025: Removed favorite recipes and all recipes sections from home tab, added favorites filter to "Recetas" tab
- June 24, 2025: Removed "Acciones Rápidas" section from home tab and moved recipe creation to "Recetas" tab only
- June 24, 2025: Fixed duplicate close buttons in meal selection modal
- June 24, 2025: Added meal deletion functionality with hover-to-show delete buttons in weekly calendar
- June 24, 2025: Fixed deployment issues with production error handling and environment validation
- June 24, 2025: Added process-level error handlers to prevent server crashes in production
- June 24, 2025: Enhanced static file serving configuration for production deployment
- June 24, 2025: Added PostgreSQL database integration with persistent data storage
- June 24, 2025: Added "Current Week" navigation button to quickly return to the current week
- June 23, 2025: Updated meal planning system to support separate lunch and dinner scheduling for each day
- June 23, 2025: Enhanced weekly calendar with dedicated lunch/dinner sections
- June 23, 2025: Added meal selection modal for choosing recipes for specific meal types
- June 23, 2025: Initial setup with Spanish Argentina localization