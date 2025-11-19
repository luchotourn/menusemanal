# AddMealButton Component Documentation

## Overview

A highly customizable button component for adding meals to the weekly meal plan. Supports extensive styling customization through props and includes preset variants for common use cases.

## Import

```typescript
import { AddMealButton } from "@/components/add-meal-button";
```

## Basic Usage

```tsx
// Simplest usage - uses default styling
<AddMealButton onClick={() => handleAddMeal()} />
```

## Props Reference

### Core Functionality

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClick` | `() => void` | **Required** | Function called when button is clicked |
| `disabled` | `boolean` | `false` | Disables the button |

### Label Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `"Agregar nuevo +"` | Button text |
| `showIcon` | `boolean` | `false` | Shows Plus icon |
| `iconPosition` | `"left" \| "right"` | `"left"` | Icon position relative to text |

### Border Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `borderStyle` | `"solid" \| "dashed" \| "dotted" \| "none"` | `"dashed"` | Border style |
| `borderWidth` | `"1" \| "2" \| "3" \| "4"` | `"1"` | Border width in pixels |
| `borderColor` | `string` | `"gray-400"` | Tailwind color class |
| `borderRadius` | `"none" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl" \| "full"` | `"lg"` | Border radius |

### Color Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `textColor` | `string` | `"gray-600"` | Text color (Tailwind class) |
| `backgroundColor` | `string` | `"transparent"` | Background color (Tailwind class) |

### Hover State Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hoverBorderColor` | `string` | `"app-accent"` | Border color on hover |
| `hoverTextColor` | `string` | `"app-accent"` | Text color on hover |
| `hoverBackgroundColor` | `string` | `"orange-50/50"` | Background color on hover |

### Padding Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `padding` | `object` | `{ x: "4", y: "2" }` | Padding configuration |
| `padding.x` | `string` | `"4"` | Horizontal padding (px-*) |
| `padding.y` | `string` | `"2"` | Vertical padding (py-*) |
| `padding.top` | `string` | - | Top padding (pt-*) |
| `padding.bottom` | `string` | - | Bottom padding (pb-*) |
| `padding.left` | `string` | - | Left padding (pl-*) |
| `padding.right` | `string` | - | Right padding (pr-*) |

### Size Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fontSize` | `"xs" \| "sm" \| "base" \| "lg" \| "xl"` | `"sm"` | Font size |
| `fullWidth` | `boolean` | `true` | Button spans full width |
| `minHeight` | `string` | - | Minimum height (e.g., "44px") |

### Variant Presets

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "empty" \| "append" \| "primary" \| "secondary"` | - | Preset styling variant |

### Additional

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `ariaLabel` | `string` | - | Accessibility label |

## Variant Presets

### `variant="default"`
Standard dashed border button with subtle styling
```tsx
<AddMealButton
  variant="default"
  onClick={handleAddMeal}
/>
```

### `variant="empty"`
Used when no meals exist - larger padding, includes icon
```tsx
<AddMealButton
  variant="empty"
  onClick={handleAddMeal}
  label="Agregar almuerzo"
/>
```

### `variant="append"`
Compact button for adding additional meals
```tsx
<AddMealButton
  variant="append"
  onClick={handleAddMeal}
/>
```

### `variant="primary"`
Prominent call-to-action style
```tsx
<AddMealButton
  variant="primary"
  onClick={handleAddMeal}
  label="Crear Plan Semanal"
/>
```

### `variant="secondary"`
Subtle solid border style
```tsx
<AddMealButton
  variant="secondary"
  onClick={handleAddMeal}
/>
```

## Usage Examples

### Example 1: Custom Colors
```tsx
<AddMealButton
  onClick={handleAddMeal}
  label="Agregar cena"
  borderColor="blue-400"
  textColor="blue-600"
  hoverBorderColor="blue-600"
  hoverTextColor="blue-800"
  hoverBackgroundColor="blue-50"
/>
```

### Example 2: Custom Padding
```tsx
<AddMealButton
  onClick={handleAddMeal}
  padding={{ x: "8", y: "4" }}
  // Or use specific sides
  padding={{ top: "4", bottom: "4", left: "6", right: "6" }}
/>
```

### Example 3: With Icon
```tsx
<AddMealButton
  onClick={handleAddMeal}
  showIcon={true}
  iconPosition="left"
  label="Nueva receta"
/>
```

### Example 4: Solid Border
```tsx
<AddMealButton
  onClick={handleAddMeal}
  borderStyle="solid"
  borderWidth="2"
  borderColor="green-500"
  borderRadius="xl"
/>
```

### Example 5: Custom Size
```tsx
<AddMealButton
  onClick={handleAddMeal}
  fontSize="lg"
  minHeight="56px"
  fullWidth={false}
/>
```

### Example 6: Disabled State
```tsx
<AddMealButton
  onClick={handleAddMeal}
  disabled={true}
  label="No disponible"
/>
```

### Example 7: Mobile Touch Target
```tsx
<AddMealButton
  onClick={handleAddMeal}
  minHeight="44px" // Meets accessibility standards
  padding={{ x: "4", y: "3" }}
/>
```

### Example 8: Complete Custom Styling
```tsx
<AddMealButton
  onClick={handleAddMeal}
  label="Agregar comida especial"
  borderStyle="dotted"
  borderWidth="2"
  borderColor="purple-400"
  borderRadius="2xl"
  textColor="purple-700"
  backgroundColor="purple-50"
  hoverBorderColor="purple-600"
  hoverTextColor="white"
  hoverBackgroundColor="purple-600"
  padding={{ x: "6", y: "3" }}
  fontSize="base"
  showIcon={true}
  iconPosition="right"
  className="shadow-sm"
/>
```

## Integration with Weekly Calendar

### Empty Meal Slot
```tsx
// In MealSection component
{meals.length === 0 ? (
  <AddMealButton
    variant="empty"
    onClick={() => onAddMeal(formatDate(date), mealType)}
    label="Agregar nuevo +"
  />
) : (
  // ... meal cards
)}
```

### Adding Additional Meals
```tsx
// After existing meals
<div className="space-y-1">
  {meals.map((meal) => (
    <MealCard key={meal.id} meal={meal} />
  ))}

  <AddMealButton
    variant="append"
    onClick={() => onAddMeal(formatDate(date), mealType)}
    className="mt-2"
  />
</div>
```

## Accessibility

The component includes:
- Semantic `<button>` element
- Keyboard support (Tab, Enter, Space)
- Focus visible states (ring on focus)
- `aria-label` support for screen readers
- Disabled state handling
- Minimum touch target support

## Styling Notes

All color props use Tailwind CSS color classes:
- Use color names without `text-`, `bg-`, or `border-` prefixes
- Examples: `"gray-400"`, `"app-accent"`, `"orange-500"`
- Supports opacity: `"orange-50/50"` (50% opacity)

## Performance

- Component is memoization-friendly
- No internal state
- Minimal re-renders
- Lightweight DOM structure

## Future Enhancements

Potential additions:
- Loading state with spinner
- Icon size customization
- Gradient backgrounds
- Animation presets
- Tooltip integration
