import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Users, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFamilies } from "@/hooks/useAuth";
import { joinFamilySchema, type JoinFamilyData } from "@shared/schema";

interface JoinFamilyModalProps {
  onClose: () => void;
}

export function JoinFamilyModal({ onClose }: JoinFamilyModalProps) {
  const { joinFamily, isJoining } = useFamilies();
  
  const form = useForm<JoinFamilyData>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: {
      codigoInvitacion: "",
    },
  });

  const onSubmit = async (data: JoinFamilyData) => {
    try {
      await joinFamily(data);
      onClose();
    } catch (error) {
      // Error is handled by the mutation's onError callback
      console.error("Join family error:", error);
    }
  };

  // Format the input to show XXX-XXX format as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get raw value and clean it
    let value = e.target.value.replace(/[^A-Z0-9-]/gi, '').toUpperCase();

    // Remove any existing dashes
    value = value.replace(/-/g, '');

    // Limit to 6 characters
    if (value.length > 6) {
      value = value.slice(0, 6);
    }

    // Add dash after 3 characters
    if (value.length > 3) {
      value = `${value.slice(0, 3)}-${value.slice(3)}`;
    }

    // Update the form value
    form.setValue("codigoInvitacion", value, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <UserPlus className="w-5 h-5 text-app-primary" />
          <span>Unirse a una Familia</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-app-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-app-primary" />
          </div>
          <p className="text-gray-600">
            Ingresa el código de invitación que te compartió el administrador de la familia.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigoInvitacion">Código de Invitación</Label>
            <Input
              id="codigoInvitacion"
              type="text"
              placeholder="XXX-XXX"
              maxLength={7}
              className={`text-center text-lg font-mono ${form.formState.errors.codigoInvitacion ? "border-red-500" : ""}`}
              value={form.watch("codigoInvitacion")}
              onChange={handleInputChange}
            />
            {form.formState.errors.codigoInvitacion && (
              <p className="text-sm text-red-600">
                {form.formState.errors.codigoInvitacion.message}
              </p>
            )}
            <p className="text-xs text-gray-500 text-center">
              Formato: ABC-123 (6 caracteres con guión)
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Al unirte podrás:</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Ver todas las recetas familiares</li>
              <li>• Agregar tus propias recetas</li>
              <li>• Crear y editar planes de comida</li>
              <li>• Colaborar en la planificación familiar</li>
            </ul>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isJoining}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isJoining || !form.watch("codigoInvitacion")}
            >
              {isJoining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uniéndose...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Unirse a la Familia
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}