import { Copy, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface InviteMemberModalProps {
  familyName: string;
  invitationCode: string;
  onClose: () => void;
}

export function InviteMemberModal({ familyName, invitationCode, onClose }: InviteMemberModalProps) {
  const { toast } = useToast();

  const appUrl = window.location.origin;

  const shareMessage =
`¡Hola! Te invito a unirte a nuestra familia "${familyName}" en Menu Semanal para planificar comidas juntos.

Seguí estos pasos:
1. Creá tu cuenta en: ${appUrl}/register
2. Una vez registrado, andá a Configuración Familiar
3. Tocá "Unirse a una Familia" e ingresá este código:

${invitationCode}

¡Te esperamos!`;

  const copyMessage = () => {
    navigator.clipboard.writeText(shareMessage);
    toast({
      title: "Mensaje copiado",
      description: "El mensaje de invitación ha sido copiado al portapapeles. ¡Compartilo por WhatsApp u otra app!",
    });
  };

  const shareNative = async () => {
    if (navigator.share && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Invitación a ${familyName} - Menu Semanal`,
          text: shareMessage,
        });
      } catch {
        // User cancelled share
      }
    } else {
      copyMessage();
    }
  };

  const shareWhatsApp = () => {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Share2 className="w-5 h-5 text-app-primary" />
          <span>Invitar a un miembro</span>
        </DialogTitle>
        <DialogDescription>
          Compartí este mensaje para que alguien se una a tu familia
        </DialogDescription>
      </DialogHeader>

      <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-800 whitespace-pre-line leading-relaxed">
        {shareMessage}
      </div>

      <div className="space-y-2">
        <Button onClick={shareWhatsApp} className="w-full bg-green-600 hover:bg-green-700">
          <MessageCircle className="w-4 h-4 mr-2" />
          Enviar por WhatsApp
        </Button>

        {typeof navigator.share === "function" && (
          <Button onClick={shareNative} variant="outline" className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
        )}

        <Button onClick={copyMessage} variant="outline" className="w-full">
          <Copy className="w-4 h-4 mr-2" />
          Copiar mensaje
        </Button>
      </div>
    </div>
  );
}
