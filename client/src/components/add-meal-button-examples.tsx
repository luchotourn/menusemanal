/**
 * AddMealButton Component Examples
 *
 * This file demonstrates various usage patterns for the AddMealButton component.
 * Use these examples as a reference for integrating the component into your app.
 */

import { AddMealButton } from "./add-meal-button";

export function AddMealButtonExamples() {
  const handleClick = () => {
    console.log("Button clicked!");
  };

  return (
    <div className="space-y-8 p-8 max-w-2xl">
      <h1 className="text-2xl font-bold">AddMealButton Examples</h1>

      {/* Example 1: Default Variant */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Default Variant</h2>
        <p className="text-sm text-gray-600">Standard dashed border, subtle styling</p>
        <AddMealButton variant="default" onClick={handleClick} />
      </section>

      {/* Example 2: Empty Variant */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Empty Variant</h2>
        <p className="text-sm text-gray-600">For empty meal slots, includes icon</p>
        <AddMealButton
          variant="empty"
          onClick={handleClick}
          label="Agregar almuerzo"
        />
      </section>

      {/* Example 3: Append Variant */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Append Variant</h2>
        <p className="text-sm text-gray-600">Compact, for adding additional meals</p>
        <AddMealButton variant="append" onClick={handleClick} />
      </section>

      {/* Example 4: Primary Variant */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Primary Variant</h2>
        <p className="text-sm text-gray-600">Prominent call-to-action</p>
        <AddMealButton
          variant="primary"
          onClick={handleClick}
          label="Crear Plan Semanal"
        />
      </section>

      {/* Example 5: Secondary Variant */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Secondary Variant</h2>
        <p className="text-sm text-gray-600">Subtle solid border</p>
        <AddMealButton variant="secondary" onClick={handleClick} />
      </section>

      {/* Example 6: Custom Colors */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Custom Colors</h2>
        <p className="text-sm text-gray-600">Blue theme</p>
        <AddMealButton
          onClick={handleClick}
          label="Agregar cena"
          borderColor="blue-400"
          textColor="blue-600"
          hoverBorderColor="blue-600"
          hoverTextColor="blue-800"
          hoverBackgroundColor="blue-50"
        />
      </section>

      {/* Example 7: With Icon Left */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. With Icon (Left)</h2>
        <p className="text-sm text-gray-600">Icon on the left side</p>
        <AddMealButton
          onClick={handleClick}
          showIcon={true}
          iconPosition="left"
          label="Nueva receta"
        />
      </section>

      {/* Example 8: With Icon Right */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. With Icon (Right)</h2>
        <p className="text-sm text-gray-600">Icon on the right side</p>
        <AddMealButton
          onClick={handleClick}
          showIcon={true}
          iconPosition="right"
          label="Agregar nuevo"
        />
      </section>

      {/* Example 9: Solid Border */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. Solid Border</h2>
        <p className="text-sm text-gray-600">Green solid border</p>
        <AddMealButton
          onClick={handleClick}
          borderStyle="solid"
          borderWidth="2"
          borderColor="green-500"
          textColor="green-700"
          hoverBorderColor="green-700"
          hoverTextColor="white"
          hoverBackgroundColor="green-500"
        />
      </section>

      {/* Example 10: Dotted Border */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">10. Dotted Border</h2>
        <p className="text-sm text-gray-600">Purple dotted border</p>
        <AddMealButton
          onClick={handleClick}
          borderStyle="dotted"
          borderWidth="2"
          borderColor="purple-400"
          textColor="purple-700"
        />
      </section>

      {/* Example 11: Custom Padding */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">11. Custom Padding</h2>
        <p className="text-sm text-gray-600">Large padding</p>
        <AddMealButton
          onClick={handleClick}
          padding={{ x: "8", y: "4" }}
          label="Botón espacioso"
        />
      </section>

      {/* Example 12: Large Font */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">12. Large Font</h2>
        <p className="text-sm text-gray-600">Bigger text size</p>
        <AddMealButton
          onClick={handleClick}
          fontSize="lg"
          padding={{ x: "6", y: "3" }}
          label="Texto grande"
        />
      </section>

      {/* Example 13: Not Full Width */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">13. Auto Width</h2>
        <p className="text-sm text-gray-600">Width fits content</p>
        <AddMealButton
          onClick={handleClick}
          fullWidth={false}
          label="Botón compacto"
        />
      </section>

      {/* Example 14: Minimum Height (Touch Target) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">14. Touch Target</h2>
        <p className="text-sm text-gray-600">44px minimum for mobile accessibility</p>
        <AddMealButton
          onClick={handleClick}
          minHeight="44px"
          label="Touch friendly"
        />
      </section>

      {/* Example 15: Disabled State */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">15. Disabled State</h2>
        <p className="text-sm text-gray-600">Cannot be clicked</p>
        <AddMealButton
          onClick={handleClick}
          disabled={true}
          label="No disponible"
        />
      </section>

      {/* Example 16: Fully Customized */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">16. Fully Customized</h2>
        <p className="text-sm text-gray-600">All custom properties</p>
        <AddMealButton
          onClick={handleClick}
          label="Comida Especial ✨"
          borderStyle="dashed"
          borderWidth="2"
          borderColor="rose-400"
          borderRadius="2xl"
          textColor="rose-700"
          backgroundColor="rose-50"
          hoverBorderColor="rose-600"
          hoverTextColor="white"
          hoverBackgroundColor="rose-600"
          padding={{ x: "6", y: "3" }}
          fontSize="base"
          showIcon={true}
          iconPosition="left"
          className="shadow-md"
        />
      </section>

      {/* Example 17: Integration Example - Empty Slot */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">17. Integration: Empty Meal Slot</h2>
        <p className="text-sm text-gray-600">Typical usage in weekly calendar</p>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Almuerzo</span>
          </div>
          <AddMealButton
            variant="empty"
            onClick={handleClick}
            label="Agregar nuevo +"
          />
        </div>
      </section>

      {/* Example 18: Integration Example - Add More */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">18. Integration: Add More Meals</h2>
        <p className="text-sm text-gray-600">After existing meal cards</p>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
            <p className="text-sm font-semibold">Pasta con verduras</p>
          </div>
          <AddMealButton
            variant="append"
            onClick={handleClick}
            label="Agregar otra comida"
          />
        </div>
      </section>

      {/* Example 19: Different Border Radius */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">19. Border Radius Variations</h2>
        <div className="space-y-2">
          <AddMealButton onClick={handleClick} borderRadius="none" label="Sin redondeo" />
          <AddMealButton onClick={handleClick} borderRadius="sm" label="Pequeño" />
          <AddMealButton onClick={handleClick} borderRadius="md" label="Medio" />
          <AddMealButton onClick={handleClick} borderRadius="lg" label="Grande (default)" />
          <AddMealButton onClick={handleClick} borderRadius="xl" label="Extra grande" />
          <AddMealButton onClick={handleClick} borderRadius="2xl" label="2XL" />
          <AddMealButton onClick={handleClick} borderRadius="full" label="Completamente redondo" />
        </div>
      </section>

      {/* Example 20: Different Border Widths */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">20. Border Width Variations</h2>
        <div className="space-y-2">
          <AddMealButton onClick={handleClick} borderWidth="1" label="Borde 1px" />
          <AddMealButton onClick={handleClick} borderWidth="2" label="Borde 2px" />
          <AddMealButton onClick={handleClick} borderWidth="3" label="Borde 3px" />
          <AddMealButton onClick={handleClick} borderWidth="4" label="Borde 4px" />
        </div>
      </section>
    </div>
  );
}

/**
 * INTEGRATION GUIDE
 *
 * To use in weekly-calendar.tsx:
 *
 * 1. Import the component:
 *    import { AddMealButton } from "@/components/add-meal-button";
 *
 * 2. Replace empty state (around line 217):
 *    <AddMealButton
 *      variant="empty"
 *      onClick={() => onAddMeal(formatDate(date), mealType)}
 *      label="Agregar nuevo +"
 *    />
 *
 * 3. Add to existing meals (after line 214):
 *    {meals.map(meal => <MealCard key={meal.id} meal={meal} />)}
 *    <AddMealButton
 *      variant="append"
 *      onClick={() => onAddMeal(formatDate(date), mealType)}
 *      className="mt-1"
 *    />
 *
 * 4. Customize as needed:
 *    - Change colors to match your design
 *    - Adjust padding for mobile/desktop
 *    - Add icons for better UX
 *    - Use different variants for different contexts
 */
