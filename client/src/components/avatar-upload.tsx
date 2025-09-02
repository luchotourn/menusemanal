import React, { useState, useCallback } from "react";
import { Upload, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  currentAvatar?: string;
  onAvatarChange: (avatar: string | null) => void;
  isUploading?: boolean;
  disabled?: boolean;
}

export function AvatarUpload({ 
  currentAvatar, 
  onAvatarChange, 
  isUploading = false,
  disabled = false 
}: AvatarUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar || null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten imágenes (PNG, JPG, JPEG)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (1MB limit)
    if (file.size > 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "La imagen debe ser menor a 1MB",
        variant: "destructive"
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      onAvatarChange(result);
    };
    reader.onerror = () => {
      toast({
        title: "Error al leer archivo",
        description: "No se pudo procesar la imagen",
        variant: "destructive"
      });
    };
    reader.readAsDataURL(file);
  }, [onAvatarChange, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled || isUploading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [disabled, isUploading, handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [disabled, isUploading, handleFile]);

  const removeAvatar = () => {
    setPreviewUrl(null);
    onAvatarChange(null);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar Preview */}
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={previewUrl || undefined} alt="Avatar" />
          <AvatarFallback>
            <User className="h-12 w-12" />
          </AvatarFallback>
        </Avatar>
        
        {previewUrl && !disabled && (
          <Button
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={removeAvatar}
            disabled={isUploading}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Upload Area */}
      <Card className={`w-full max-w-sm ${dragActive ? "border-blue-500 bg-blue-50" : ""}`}>
        <CardContent className="p-6">
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-300 hover:border-gray-400"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              disabled={disabled || isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-medium">Haz clic para subir</span> o arrastra una imagen
              </div>
              <div className="text-xs text-gray-400">
                PNG, JPG hasta 1MB
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isUploading && (
        <div className="text-sm text-gray-500 animate-pulse">
          Subiendo imagen...
        </div>
      )}
    </div>
  );
}