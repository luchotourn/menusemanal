import { Settings as SettingsIcon, Users, Bell, Download, Share2, Info } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const handleExportData = () => {
    toast({ title: "Función de exportación próximamente disponible" });
  };

  const handleShareApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Comidas Familiares',
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

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-6">
            <SettingsIcon className="text-app-neutral w-6 h-6" />
            <h2 className="text-2xl font-bold text-app-neutral">Ajustes</h2>
          </div>

          <div className="space-y-4">
            {/* Family Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Users className="w-5 h-5 text-app-primary" />
                  <span>Configuración Familiar</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Data Management */}
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
                
                <div className="pt-2">
                  <Label className="font-medium">Código de Familia</Label>
                  <p className="text-sm text-gray-600 mb-2">
                    Comparte este código para que otros miembros de la familia puedan acceder
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-3 py-2 rounded text-sm flex-1">
                      FAM-{Math.random().toString(36).substr(2, 8).toUpperCase()}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast({ title: "Código copiado al portapapeles" })}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
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
          </div>
        </div>
      </main>
    </div>
  );
}
