import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Código copiado",
      description: "El código de invitación ha sido copiado al portapapeles",
    });
  };

  const shareCode = async () => {
    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Código de Familia - Menu Familiar',
          text: `¡Únete a nuestra familia en Menu Familiar! Usa el código: ${code}`,
          url: window.location.origin + '/family-settings',
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      copyToClipboard();
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
              onClick={copyToClipboard}
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