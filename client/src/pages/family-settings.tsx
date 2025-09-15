import { useState } from "react";
import { Users, Plus, UserPlus, Settings as SettingsIcon, Crown, User, Trash2, LogOut, RefreshCw, Copy } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFamilies, useFamily, useProfile } from "@/hooks/useAuth";
import { CreateFamilyModal } from "@/components/create-family-modal";
import { JoinFamilyModal } from "@/components/join-family-modal";
import { InvitationCodeDisplay } from "@/components/invitation-code-display";

export default function FamilySettings() {
  const { toast } = useToast();
  const { profile, isLoading: profileLoading } = useProfile();
  const { families, isLoading: familiesLoading } = useFamilies();
  
  // For now, we'll work with the user's first family
  // In the future, users might belong to multiple families
  const primaryFamilyId = families[0]?.id;
  const { 
    family, 
    members, 
    isLoadingFamily, 
    isLoadingMembers, 
    removeMember, 
    leaveFamily, 
    regenerateCode,
    isRemoving,
    isLeaving,
    isRegenerating
  } = useFamily(primaryFamilyId || 0);

  const [createFamilyOpen, setCreateFamilyOpen] = useState(false);
  const [joinFamilyOpen, setJoinFamilyOpen] = useState(false);

  const isLoading = profileLoading || familiesLoading || isLoadingFamily || isLoadingMembers;
  const currentUser = profile;
  const isAdmin = currentUser && family && currentUser.id === family.createdBy;

  const handleRemoveMember = (userId: number, memberName: string) => {
    if (window.confirm(`¿Estás seguro de que quieres remover a ${memberName} de la familia?`)) {
      removeMember(userId);
    }
  };

  const handleLeaveFamily = () => {
    if (window.confirm("¿Estás seguro de que quieres abandonar esta familia?")) {
      leaveFamily();
    }
  };

  const handleRegenerateCode = () => {
    if (window.confirm("¿Estás seguro de que quieres regenerar el código de invitación? El código anterior dejará de funcionar.")) {
      regenerateCode();
    }
  };

  const copyInvitationCode = () => {
    if (family?.codigoInvitacion) {
      navigator.clipboard.writeText(family.codigoInvitacion);
      toast({
        title: "Código copiado",
        description: "El código de invitación ha sido copiado al portapapeles",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-background">
        <Header />
        <main className="max-w-lg mx-auto px-4 pb-20">
          <div className="mt-6">
            <div className="flex items-center space-x-2 mb-6">
              <Users className="text-app-neutral w-6 h-6" />
              <h2 className="text-2xl font-bold text-app-neutral">Configuración Familiar</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-primary mx-auto"></div>
                  <p className="mt-2 text-gray-600">Cargando información familiar...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // If user has no family
  if (!family) {
    return (
      <div className="min-h-screen bg-app-background">
        <Header />
        <main className="max-w-lg mx-auto px-4 pb-20">
          <div className="mt-6">
            <div className="flex items-center space-x-2 mb-6">
              <Users className="text-app-neutral w-6 h-6" />
              <h2 className="text-2xl font-bold text-app-neutral">Configuración Familiar</h2>
            </div>

            {/* Welcome Card */}
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="w-16 h-16 text-app-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">¡Organiza las comidas en familia!</h3>
                  <p className="text-gray-600 mb-4">
                    Crea una familia o únete a una existente para compartir recetas y planificar comidas juntos.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Dialog open={createFamilyOpen} onOpenChange={setCreateFamilyOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Crear Nueva Familia
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <CreateFamilyModal onClose={() => setCreateFamilyOpen(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={joinFamilyOpen} onOpenChange={setJoinFamilyOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" size="lg">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Unirse a una Familia
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <JoinFamilyModal onClose={() => setJoinFamilyOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            {/* Info Card */}
            <Card className="mt-6 bg-gradient-to-r from-app-primary/10 to-app-secondary/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">👨‍👩‍👧‍👦</div>
                  <h3 className="font-semibold text-app-neutral mb-2">¿Cómo funciona?</h3>
                  <p className="text-sm text-gray-600">
                    Al crear una familia, recibes un código único para invitar a otros miembros. 
                    Todos podrán ver y editar las recetas y planes de comida compartidos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="text-app-neutral w-6 h-6" />
            <h2 className="text-2xl font-bold text-app-neutral">Configuración Familiar</h2>
          </div>

          <div className="space-y-4">
            {/* Family Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Users className="w-5 h-5 text-app-primary" />
                  <span>{family.nombre}</span>
                  {isAdmin && <Crown className="w-4 h-4 text-yellow-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {members.length} miembro{members.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <InvitationCodeDisplay 
                  code={family.codigoInvitacion}
                  isAdmin={isAdmin || false}
                  onRegenerate={handleRegenerateCode}
                  isRegenerating={isRegenerating}
                />
              </CardContent>
            </Card>

            {/* Family Members */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Miembros de la Familia</span>
                  {isAdmin && (
                    <Dialog open={joinFamilyOpen} onOpenChange={setJoinFamilyOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invitar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <JoinFamilyModal onClose={() => setJoinFamilyOpen(false)} />
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member, index) => (
                  <div key={member.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar} alt={member.name} />
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <p className="font-medium flex items-center space-x-2">
                            <span>{member.name}</span>
                            {member.role === "admin" && (
                              <Badge variant="secondary" className="text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                      </div>

                      {/* Member Actions */}
                      {isAdmin && member.id !== currentUser?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          disabled={isRemoving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {index < members.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Family Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <SettingsIcon className="w-5 h-5 text-app-primary" />
                  <span>Acciones</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleLeaveFamily}
                    disabled={isLeaving}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {isLeaving ? "Abandonando..." : "Abandonar Familia"}
                  </Button>
                )}
                
                {isAdmin && members.length === 1 && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleLeaveFamily}
                    disabled={isLeaving}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isLeaving ? "Eliminando..." : "Eliminar Familia"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="bg-gradient-to-r from-app-primary/10 to-app-secondary/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">💡</div>
                  <h3 className="font-semibold text-app-neutral mb-2">Consejo</h3>
                  <p className="text-sm text-gray-600">
                    {isAdmin 
                      ? "Como administrador, puedes invitar nuevos miembros y gestionar la familia. ¡Comparte el código con tus seres queridos!"
                      : "Todos los miembros pueden agregar recetas y crear planes de comida. ¡Colabora para hacer las mejores comidas familiares!"
                    }
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