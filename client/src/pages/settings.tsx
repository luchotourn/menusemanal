import { Settings as SettingsIcon, Users, Bell, Download, Share2, Info, User, LogOut, Star } from "lucide-react";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useProfile, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/components/role-based-wrapper";

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { profile, isLoading } = useProfile();
  const { logout } = useAuth();
  const { isCommentator } = useUserRole();


  const handleExportData = () => {
    toast({ title: "Función de exportación próximamente disponible" });
  };

  const handleShareApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Menu Familiar',
          text: '¡Organiza las comidas de tu familia con esta increíble app!',
          url: window.location.origin,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      toast({ title: "Compartir app", description: "Copia el enlace: " + window.location.origin });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Sesión cerrada exitosamente" });
      setLocation("/login");
    } catch (error) {
      toast({ title: "Error al cerrar sesión", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-6">
            {isCommentator ? (
              <>
                <User className="text-purple-600 w-6 h-6" />
                <h2 className="text-2xl font-bold text-purple-800">Mi Perfil</h2>
              </>
            ) : (
              <>
                <SettingsIcon className="text-app-neutral w-6 h-6" />
                <h2 className="text-2xl font-bold text-app-neutral">Ajustes</h2>
              </>
            )}
          </div>

          <div className="space-y-4">
            {/* User Profile */}
            <Card className={isCommentator ? "border-purple-200 bg-gradient-to-br from-white to-purple-50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <User className={`w-5 h-5 ${isCommentator ? "text-purple-600" : "text-app-primary"}`} />
                  <span className={isCommentator ? "text-purple-800" : ""}>
                    {isCommentator ? "Mi Información" : "Perfil de Usuario"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation("/profile")}
                >
                  <User className="w-4 h-4 mr-2" />
                  Gestionar Perfil
                </Button>
                <p className="text-sm text-gray-600 mt-2">
                  Actualiza tu información personal, avatar y configuraciones de seguridad
                </p>
              </CardContent>
            </Card>

            {/* Family Settings */}
            <Card className={isCommentator ? "border-purple-200 bg-gradient-to-br from-white to-purple-50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Users className={`w-5 h-5 ${isCommentator ? "text-purple-600" : "text-app-primary"}`} />
                  <span className={isCommentator ? "text-purple-800" : ""}>
                    {isCommentator ? "Mi Familia" : "Configuración Familiar"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setLocation("/family-settings")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {profile?.familyId ? "Gestionar Familia" : "Crear o Unirse a Familia"}
                </Button>
                <p className="text-sm text-gray-600">
                  {profile?.familyId
                    ? "Gestiona miembros y comparte códigos de invitación"
                    : profile?.role === "commentator"
                      ? "¡Únete a tu familia para empezar a calificar las comidas!"
                      : "Crea o únete a una familia para compartir recetas"
                  }
                </p>
                
                <div className="pt-2 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notifications" className="font-medium">Notificaciones</Label>
                      <p className="text-sm text-gray-600">Recibir recordatorios de comidas</p>
                    </div>
                    <Switch id="notifications" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="weekly-planning" className="font-medium">Planificación Semanal</Label>
                      <p className="text-sm text-gray-600">Mostrar próxima semana automáticamente</p>
                    </div>
                    <Switch id="weekly-planning" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="kid-ratings" className="font-medium">Calificaciones de los Chicos</Label>
                      <p className="text-sm text-gray-600">Permitir que los chicos califiquen</p>
                    </div>
                    <Switch id="kid-ratings" defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Management - Only for creators */}
            {!isCommentator && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Download className="w-5 h-5 text-app-secondary" />
                  <span>Gestión de Datos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleExportData}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Recetas
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleExportData}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Hacer Copia de Seguridad
                </Button>
              </CardContent>
            </Card>
            )}

            {/* Sharing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Share2 className="w-5 h-5 text-app-accent" />
                  <span>Compartir</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleShareApp}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartir App
                </Button>
              </CardContent>
            </Card>

            {/* App Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <span>Información de la App</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Versión:</span>
                    <p className="text-gray-600">1.0.0</p>
                  </div>
                  <div>
                    <span className="font-medium">Recetas:</span>
                    <p className="text-gray-600">Ilimitadas</p>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 text-center">
                    Hecho con ❤️ para familias que aman comer bien
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="bg-gradient-to-r from-app-primary/10 to-app-secondary/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">💡</div>
                  <h3 className="font-semibold text-app-neutral mb-2">Consejo</h3>
                  <p className="text-sm text-gray-600">
                    ¡Involucra a los chicos en la planificación! Deja que ellos califiquen las comidas para crear un menú que realmente les guste.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Logout Section */}
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <LogOut className="w-5 h-5 text-red-500" />
                  <span>Cerrar Sesión</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </Button>
                <p className="text-sm text-gray-600 mt-2">
                  Cierra tu sesión actual y regresa a la pantalla de inicio de sesión
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
