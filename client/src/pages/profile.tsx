import React, { useState } from "react";
import { 
  User, 
  Shield, 
  Bell, 
  ArrowLeft, 
  Trash2,
  Edit3,
  Save,
  X
} from "lucide-react";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/avatar-upload";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { useProfile } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  updateProfileSchema, 
  accountDeletionSchema,
  type UpdateProfileData, 
  type AccountDeletionData 
} from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    profile,
    isLoading,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAccount,
    isUpdating,
    isChangingPassword,
    isUploadingAvatar,
    isDeletingAccount
  } = useProfile();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
    setValue
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: profile?.name || "",
      email: profile?.email || "",
      notificationPreferences: profile?.notificationPreferences || {
        email: true,
        recipes: true,
        mealPlans: true
      }
    }
  });

  const {
    register: registerDelete,
    handleSubmit: handleDeleteSubmit,
    formState: { errors: deleteErrors },
    reset: resetDelete
  } = useForm<AccountDeletionData>({
    resolver: zodResolver(accountDeletionSchema)
  });

  // Update form when profile data loads
  React.useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        email: profile.email,
        notificationPreferences: profile.notificationPreferences || {
          email: true,
          recipes: true,
          mealPlans: true
        }
      });
    }
  }, [profile, reset]);

  const notificationPreferences = watch("notificationPreferences");

  const onSubmitProfile = (data: UpdateProfileData) => {
    // Include pending avatar if any
    const updateData = {
      ...data,
      avatar: pendingAvatar || profile?.avatar
    };
    
    updateProfile(updateData);
    setIsEditing(false);
    setPendingAvatar(null);
  };

  const handleCancelEdit = () => {
    reset();
    setPendingAvatar(null);
    setIsEditing(false);
  };

  const handleAvatarChange = (avatar: string | null) => {
    setPendingAvatar(avatar);
    if (avatar) {
      uploadAvatar({ avatar });
    }
  };

  const onDeleteAccount = (data: AccountDeletionData) => {
    deleteAccount(data);
    resetDelete();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Perfil" showBack />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Perfil" showBack />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Información</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferencias</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Information Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>
                    Actualiza tu información de perfil y avatar
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit(onSubmitProfile)}
                      disabled={isUpdating || !isDirty}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isUpdating ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex justify-center">
                  <AvatarUpload
                    currentAvatar={pendingAvatar || profile?.avatar}
                    onAvatarChange={handleAvatarChange}
                    isUploading={isUploadingAvatar}
                    disabled={!isEditing}
                  />
                </div>

                <Separator />

                {/* Profile Form */}
                <form onSubmit={handleSubmit(onSubmitProfile)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre completo</Label>
                      <Input
                        id="name"
                        {...register("name")}
                        disabled={!isEditing}
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register("email")}
                        disabled={!isEditing}
                        className={errors.email ? "border-red-500" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-600">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>Rol:</strong> {profile?.role === "admin" ? "Administrador" : "Miembro"}
                    </div>
                    <div>
                      <strong>Miembro desde:</strong>{" "}
                      {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seguridad de la Cuenta</CardTitle>
                <CardDescription>
                  Gestiona la seguridad de tu cuenta y contraseña
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Contraseña</h4>
                    <p className="text-sm text-gray-600">
                      Última actualización: {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowChangePassword(true)}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "Cambiando..." : "Cambiar Contraseña"}
                  </Button>
                </div>

                <Separator />

                {/* Account Deletion */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h4 className="font-medium text-red-800 mb-2">Zona de Peligro</h4>
                  <p className="text-sm text-red-600 mb-4">
                    Eliminar tu cuenta es permanente y no se puede deshacer. Se eliminarán todas tus recetas y planificaciones.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Eliminar Cuenta
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará permanentemente tu cuenta
                          y todos los datos asociados de nuestros servidores.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <form onSubmit={handleDeleteSubmit(onDeleteAccount)} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="confirmationText">
                            Escribe <strong>ELIMINAR</strong> para confirmar:
                          </Label>
                          <Input
                            id="confirmationText"
                            {...registerDelete("confirmationText")}
                            placeholder="ELIMINAR"
                            className={deleteErrors.confirmationText ? "border-red-500" : ""}
                          />
                          {deleteErrors.confirmationText && (
                            <p className="text-sm text-red-600">
                              {deleteErrors.confirmationText.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password">Confirma con tu contraseña:</Label>
                          <Input
                            id="password"
                            type="password"
                            {...registerDelete("password")}
                            placeholder="Tu contraseña"
                            className={deleteErrors.password ? "border-red-500" : ""}
                          />
                          {deleteErrors.password && (
                            <p className="text-sm text-red-600">
                              {deleteErrors.password.message}
                            </p>
                          )}
                        </div>

                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => resetDelete()}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            type="submit"
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeletingAccount}
                          >
                            {isDeletingAccount ? "Eliminando..." : "Eliminar Cuenta"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </form>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Notificación</CardTitle>
                <CardDescription>
                  Controla qué notificaciones quieres recibir
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones por Email</Label>
                      <p className="text-sm text-gray-600">
                        Recibe notificaciones importantes por email
                      </p>
                    </div>
                    <Switch
                      checked={notificationPreferences?.email || false}
                      onCheckedChange={(checked) => 
                        setValue("notificationPreferences.email", checked, { shouldDirty: true })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones de Recetas</Label>
                      <p className="text-sm text-gray-600">
                        Recibe notificaciones sobre nuevas recetas y favoritos
                      </p>
                    </div>
                    <Switch
                      checked={notificationPreferences?.recipes || false}
                      onCheckedChange={(checked) => 
                        setValue("notificationPreferences.recipes", checked, { shouldDirty: true })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones de Planificación</Label>
                      <p className="text-sm text-gray-600">
                        Recibe recordatorios sobre tu planificación semanal
                      </p>
                    </div>
                    <Switch
                      checked={notificationPreferences?.mealPlans || false}
                      onCheckedChange={(checked) => 
                        setValue("notificationPreferences.mealPlans", checked, { shouldDirty: true })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                {isEditing && isDirty && (
                  <div className="pt-4">
                    <Button 
                      onClick={handleSubmit(onSubmitProfile)}
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? "Guardando..." : "Guardar Preferencias"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        onChangePassword={changePassword}
        isLoading={isChangingPassword}
      />
    </div>
  );
}