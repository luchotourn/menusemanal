import { useState, useEffect } from "react";
import { X, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertRecipe, Recipe } from "@shared/schema";

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
}

const categories = [
  "Plato Principal",
  "Postre",
  "Merienda",
  "Desayuno",
  "Entrada",
  "Sopa",
  "Ensalada",
  "Bebida"
];

export function AddRecipeModal({ isOpen, onClose, recipe }: AddRecipeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!recipe;

  const [formData, setFormData] = useState<InsertRecipe>({
    nombre: "",
    descripcion: "",
    imagen: "",
    enlaceExterno: "",
    categoria: "",
    calificacionNinos: 0,
    ingredientes: [],
    instrucciones: "",
    tiempoPreparacion: 0,
    porciones: 0,
    esFavorita: 0,
  });

  // Update form data when recipe changes
  useEffect(() => {
    if (recipe) {
      setFormData({
        nombre: recipe.nombre || "",
        descripcion: recipe.descripcion || "",
        imagen: recipe.imagen || "",
        enlaceExterno: recipe.enlaceExterno || "",
        categoria: recipe.categoria || "",
        calificacionNinos: recipe.calificacionNinos || 0,
        ingredientes: recipe.ingredientes || [],
        instrucciones: recipe.instrucciones || "",
        tiempoPreparacion: recipe.tiempoPreparacion || 0,
        porciones: recipe.porciones || 0,
        esFavorita: recipe.esFavorita || 0,
      });
    } else {
      resetForm();
    }
  }, [recipe, isOpen]);

  const [ingredientInput, setIngredientInput] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: InsertRecipe) => {
      const response = await apiRequest("POST", "/api/recipes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "¡Receta creada exitosamente!" });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({ title: "Error al crear la receta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertRecipe) => {
      const response = await apiRequest("PUT", `/api/recipes/${recipe!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "¡Receta actualizada exitosamente!" });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({ title: "Error al actualizar la receta", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/recipes/${recipe!.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar la receta");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "¡Receta eliminada exitosamente!" });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error al eliminar la receta", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      imagen: "",
      enlaceExterno: "",
      categoria: "",
      calificacionNinos: 0,
      ingredientes: [],
      instrucciones: "",
      tiempoPreparacion: 0,
      porciones: 0,
      esFavorita: 0,
    });
    setIngredientInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim() || !formData.categoria) {
      toast({ title: "Por favor completa los campos obligatorios", variant: "destructive" });
      return;
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer.")) {
      deleteMutation.mutate();
    }
  };

  const addIngredient = () => {
    if (ingredientInput.trim()) {
      setFormData(prev => ({
        ...prev,
        ingredientes: [...prev.ingredientes, ingredientInput.trim()]
      }));
      setIngredientInput("");
    }
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredientes: prev.ingredientes.filter((_, i) => i !== index)
    }));
  };

  const renderStarRating = () => {
    return (
      <div className="flex items-center space-x-1">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, calificacionNinos: i + 1 }))}
            className={`text-2xl ${i < formData.calificacionNinos ? "text-app-accent" : "text-gray-300"}`}
          >
            <Star className="w-6 h-6 fill-current" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white border-b border-gray-100 p-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-app-neutral">
            {isEditing ? "Editar Receta" : "Agregar Nueva Receta"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="text-gray-600 w-4 h-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre de la Receta *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Empanadas de Carne"
              required
            />
          </div>

          <div>
            <Label htmlFor="categoria">Categoría *</Label>
            <Select 
              value={formData.categoria} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Describe brevemente la receta..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="imagen">URL de Imagen (opcional)</Label>
            <Input
              id="imagen"
              value={formData.imagen}
              onChange={(e) => setFormData(prev => ({ ...prev, imagen: e.target.value }))}
              placeholder="https://ejemplo.com/imagen.jpg"
              type="url"
            />
            {formData.imagen && formData.imagen.startsWith('http') && (
              <div className="mt-2">
                <img 
                  src={formData.imagen} 
                  alt="Preview" 
                  className="w-24 h-24 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="enlaceExterno">Enlace Externo</Label>
            <Input
              id="enlaceExterno"
              type="url"
              value={formData.enlaceExterno}
              onChange={(e) => setFormData(prev => ({ ...prev, enlaceExterno: e.target.value }))}
              placeholder="https://ejemplo.com/receta"
            />
          </div>

          <div>
            <Label>Calificación de los Chicos</Label>
            {renderStarRating()}
          </div>

          <div>
            <Label>Ingredientes</Label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Input
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  placeholder="Ej: 500g carne picada"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIngredient();
                    }
                  }}
                />
                <Button type="button" onClick={addIngredient} variant="outline">
                  Agregar
                </Button>
              </div>
              {formData.ingredientes.length > 0 && (
                <div className="space-y-2">
                  {formData.ingredientes.map((ingrediente, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm">{ingrediente}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="instrucciones">Instrucciones</Label>
            <Textarea
              id="instrucciones"
              value={formData.instrucciones}
              onChange={(e) => setFormData(prev => ({ ...prev, instrucciones: e.target.value }))}
              placeholder="Paso a paso para preparar la receta..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tiempoPreparacion">Tiempo (minutos)</Label>
              <Input
                id="tiempoPreparacion"
                type="number"
                value={formData.tiempoPreparacion || ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tiempoPreparacion: parseInt(e.target.value) || 0 
                }))}
                placeholder="60"
              />
            </div>
            <div>
              <Label htmlFor="porciones">Porciones</Label>
              <Input
                id="porciones"
                type="number"
                value={formData.porciones || ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  porciones: parseInt(e.target.value) || 0 
                }))}
                placeholder="4"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="esFavorita"
              checked={formData.esFavorita === 1}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                esFavorita: e.target.checked ? 1 : 0 
              }))}
              className="rounded"
            />
            <Label htmlFor="esFavorita">Marcar como favorita</Label>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-app-primary text-white hover:bg-app-primary/90"
              disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
            >
              {isEditing ? "Actualizar Receta" : "Crear Receta"}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                className="px-3"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
