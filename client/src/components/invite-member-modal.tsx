import { Copy, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { buildInviteMessage, copyToClipboard, buildWhatsAppUrl } from "@/lib/share-utils";

interface InviteMemberModalProps {
  familyName: string;
  invitationCode: string;
  onClose: () => void;
}

export function InviteMemberModal({ familyName, invitationCode, onClose }: InviteMemberModalProps) {
  const { toast } = useToast();

  const appUrl = window.location.origin;

  const shareMessage = buildInviteMessage({ familyName, invitationCode, appUrl });

  const copyMessage = async () => {
    const success = await copyToClipboard(shareMessage);
    if (success) {
      toast({
        title: "Mensaje copiado",
        description: "El mensaje de invitación ha sido copiado al portapapeles. ¡Compartilo por WhatsApp u otra app!",
      });
    } else {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar el mensaje. Intenta nuevamente.",
        variant: "destructive",
      });
    }
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
    window.open(buildWhatsAppUrl(shareMessage), "_blank");
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
