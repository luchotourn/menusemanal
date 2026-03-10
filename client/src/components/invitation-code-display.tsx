import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildCompactInviteMessage, copyToClipboard } from "@/lib/share-utils";

interface InvitationCodeDisplayProps {
  code: string;
  isAdmin: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function InvitationCodeDisplay({
  code,
  isAdmin,
  onRegenerate,
  isRegenerating
}: InvitationCodeDisplayProps) {
  const { toast } = useToast();
  const [showCode, setShowCode] = useState(true);

  const handleCopyCode = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      toast({
        title: "Código copiado",
        description: "El código de invitación ha sido copiado al portapapeles",
      });
    } else {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar el código. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const shareCode = async () => {
    const appUrl = window.location.origin;
    const shareMessage = buildCompactInviteMessage({ invitationCode: code, appUrl });

    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Invitación a Menu Semanal',
          text: shareMessage,
        });
      } catch {
        // User cancelled share
      }
    } else {
      const success = await copyToClipboard(shareMessage);
      if (success) {
        toast({
          title: "Mensaje copiado",
          description: "El mensaje de invitación ha sido copiado al portapapeles",
        });
      } else {
        toast({
          title: "Error al copiar",
          description: "No se pudo copiar el mensaje. Intenta nuevamente.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Código de Invitación</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCode(!showCode)}
        >
          {showCode ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <code className="text-2xl font-mono font-bold text-app-primary tracking-wider">
            {showCode ? code : "•••-•••"}
          </code>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              disabled={!showCode}
            >
              <Copy className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Comparte este código con los miembros de tu familia para que puedan unirse.
        {isAdmin && " Como administrador, puedes regenerar el código si es necesario."}
      </p>

      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={shareCode}
          className="flex-1"
        >
          <Copy className="w-4 h-4 mr-2" />
          {typeof navigator.share === 'function' ? "Compartir" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
