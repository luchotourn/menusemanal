import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFamilies } from "@/hooks/useAuth";
import { createFamilySchema, type CreateFamilyData } from "@shared/schema";

interface CreateFamilyModalProps {
  onClose: () => void;
}

export function CreateFamilyModal({ onClose }: CreateFamilyModalProps) {
  const { createFamily, isCreating } = useFamilies();
  
  const form = useForm<CreateFamilyData>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      nombre: "",
    },
  });

  const onSubmit = async (data: CreateFamilyData) => {
    createFamily(data, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        // Error is handled by the mutation's onError callback
        console.error("Create family error:", error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-app-primary" />
          <span>Crear Nueva Familia</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-app-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-app-primary" />
          </div>
          <p className="text-gray-600">
            Crea tu familia para comenzar a planificar comidas juntos. 
            Se generará automáticamente un código de invitación único.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la Familia</Label>
            <Input
              id="nombre"
              type="text"
              placeholder="Ej: Familia García, Los Martínez..."
              {...form.register("nombre")}
              className={form.formState.errors.nombre ? "border-red-500" : ""}
            />
            {form.formState.errors.nombre && (
              <p className="text-sm text-red-600">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">¿Qué sucede después?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Se creará tu familia con un código único</li>
              <li>• Serás el administrador de la familia</li>
              <li>• Podrás invitar a otros miembros</li>
              <li>• Todos compartirán recetas y planes de comida</li>
            </ul>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Familia
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}