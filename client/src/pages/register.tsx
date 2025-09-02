import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, UserCog } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PasswordStrength } from "@/components/password-strength";
import { useAuth } from "@/hooks/useAuth";
import { registerSchema, type RegisterFormData } from "@shared/schema";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isRegisterLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isValid, isValidating }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "creator",
      acceptTerms: false,
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const role = watch("role");
  const acceptTerms = watch("acceptTerms");

  // Revalidate confirmPassword when password changes
  useEffect(() => {
    if (confirmPassword) {
      trigger("confirmPassword");
    }
  }, [password, confirmPassword, trigger]);

  const onSubmit = (data: RegisterFormData) => {
    console.log("Form submitted with data:", data);
    registerUser(data);
  };

  return (
    <div className="min-h-screen bg-app-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-app-primary">Menu Familiar</h1>
          <p className="text-app-neutral text-sm">Crea tu cuenta y comienza a planificar</p>
        </div>

        {/* Register Card */}
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-app-neutral text-center">
              Crear Cuenta
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Únete a la comunidad de Menu Familiar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full Name Field */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-app-neutral font-medium">
                  Nombre completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Tu nombre completo"
                    className="pl-10 h-12 border-gray-300 focus:border-app-primary focus:ring-app-primary"
                    {...register("fullName")}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                  />
                </div>
                {errors.fullName && (
                  <p id="fullName-error" className="text-sm text-red-600" role="alert">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-app-neutral font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-10 h-12 border-gray-300 focus:border-app-primary focus:ring-app-primary"
                    {...register("email")}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-red-600" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-app-neutral font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
                    className="pl-10 pr-12 h-12 border-gray-300 focus:border-app-primary focus:ring-app-primary"
                    {...register("password", {
                      onChange: () => {
                        if (confirmPassword) {
                          trigger("confirmPassword");
                        }
                      }
                    })}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-red-600" role="alert">
                    {errors.password.message}
                  </p>
                )}
                <PasswordStrength password={password} />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-app-neutral font-medium">
                  Confirmar contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirma tu contraseña"
                    className="pl-10 pr-12 h-12 border-gray-300 focus:border-app-primary focus:ring-app-primary"
                    {...register("confirmPassword")}
                    aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p id="confirmPassword-error" className="text-sm text-red-600" role="alert">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role" className="text-app-neutral font-medium">
                  Tu rol en la familia
                </Label>
                <Select value={role} onValueChange={(value: "creator" | "commentator") => setValue("role", value)}>
                  <SelectTrigger className="h-12 border-gray-300 focus:border-app-primary">
                    <div className="flex items-center space-x-2">
                      <UserCog className="h-5 w-5 text-gray-400" />
                      <SelectValue placeholder="Selecciona tu rol" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Planificador/a</span>
                        <span className="text-xs text-gray-500">Crear y editar planes de comida</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="commentator">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Observador/a</span>
                        <span className="text-xs text-gray-500">Ver planes y hacer comentarios</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p id="role-error" className="text-sm text-red-600" role="alert">
                    {errors.role.message}
                  </p>
                )}
              </div>

              {/* Terms Acceptance */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setValue("acceptTerms", !!checked)}
                  className="mt-1"
                />
                <Label
                  htmlFor="acceptTerms"
                  className="text-sm text-app-neutral cursor-pointer leading-relaxed"
                >
                  Acepto los{" "}
                  <Link href="#" className="text-app-primary hover:underline">
                    términos y condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link href="#" className="text-app-primary hover:underline">
                    política de privacidad
                  </Link>
                </Label>
              </div>
              {errors.acceptTerms && (
                <p id="acceptTerms-error" className="text-sm text-red-600" role="alert">
                  {errors.acceptTerms.message}
                </p>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isRegisterLoading || !isValid || isValidating}
                className="w-full h-12 bg-app-primary hover:bg-app-primary/90 text-white font-medium rounded-lg transition-colors"
              >
                {isRegisterLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creando cuenta...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Crear Cuenta</span>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="text-app-primary hover:underline font-medium"
                >
                  Inicia sesión aquí
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Al crear una cuenta aceptas automáticamente nuestros términos de servicio
        </p>
      </div>
    </div>
  );
}