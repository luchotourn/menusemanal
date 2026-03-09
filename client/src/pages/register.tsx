import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    console.log("Form submitted for user:", data.email);
    registerUser(data);
  };

  const inputStyle = {
    border: "1.5px solid #e8e2db",
    background: "#faf9f7",
    fontSize: "1rem",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#faf9f7",
      }}
    >
      <div className="w-full max-w-md space-y-8 py-8">
        {/* Header - matching landing page logo style */}
        <div className="text-center space-y-3">
          <a
            href="/"
            className="inline-block text-sm font-medium hover:underline"
            style={{ color: "#5a5a5a" }}
          >
            &larr; Volver al inicio
          </a>
          <h1
            className="text-4xl tracking-tight"
            style={{ fontWeight: 800, color: "#d4825a", letterSpacing: "-0.03em" }}
          >
            Menu Semanal
          </h1>
          <div
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full"
            style={{ background: "#fdf5ef", color: "#d4825a" }}
          >
            <span>&#x1F680;</span>
            Crea tu cuenta y comienza a planificar
          </div>
        </div>

        {/* Register Card - warm landing page style */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "#ffffff",
            border: "1px solid #e8e2db",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <div className="text-center mb-6">
            <h2
              className="text-2xl mb-1"
              style={{ fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}
            >
              Crear Cuenta
            </h2>
            <p className="text-sm" style={{ color: "#5a5a5a" }}>
              Unite a la comunidad de Menu Semanal
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name Field */}
            <div className="space-y-2">
              <Label
                htmlFor="fullName"
                className="text-sm"
                style={{ fontWeight: 600, color: "#1a1a1a" }}
              >
                Nombre completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Tu nombre completo"
                className="h-12 rounded-xl px-4"
                style={inputStyle}
                {...register("fullName")}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-red-600" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm"
                style={{ fontWeight: 600, color: "#1a1a1a" }}
              >
                Correo electronico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className="h-12 rounded-xl px-4"
                style={inputStyle}
                {...register("email")}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm"
                style={{ fontWeight: 600, color: "#1a1a1a" }}
              >
                Contrasena
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Tu contrasena"
                  className="h-12 rounded-xl px-4 pr-12"
                  style={inputStyle}
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
                  className="absolute right-3 top-3 hover:opacity-70 transition-opacity"
                  style={{ color: "#5a5a5a" }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
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
              <Label
                htmlFor="confirmPassword"
                className="text-sm"
                style={{ fontWeight: 600, color: "#1a1a1a" }}
              >
                Confirmar contrasena
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirma tu contrasena"
                  className="h-12 rounded-xl px-4 pr-12"
                  style={inputStyle}
                  {...register("confirmPassword")}
                  aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 hover:opacity-70 transition-opacity"
                  style={{ color: "#5a5a5a" }}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
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
              <Label
                htmlFor="role"
                className="text-sm"
                style={{ fontWeight: 600, color: "#1a1a1a" }}
              >
                Tu rol en la familia
              </Label>
              <Select value={role} onValueChange={(value: "creator" | "commentator") => setValue("role", value)}>
                <SelectTrigger
                  className="h-12 rounded-xl"
                  style={inputStyle}
                >
                  <SelectValue placeholder="Selecciona tu rol" />
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
                className="text-sm cursor-pointer leading-relaxed"
                style={{ color: "#1a1a1a" }}
              >
                Acepto los{" "}
                <Link href="#" className="font-medium hover:underline" style={{ color: "#d4825a" }}>
                  terminos y condiciones
                </Link>{" "}
                y la{" "}
                <Link href="#" className="font-medium hover:underline" style={{ color: "#d4825a" }}>
                  politica de privacidad
                </Link>
              </Label>
            </div>
            {errors.acceptTerms && (
              <p id="acceptTerms-error" className="text-sm text-red-600" role="alert">
                {errors.acceptTerms.message}
              </p>
            )}

            {/* Submit Button - matching landing page CTA */}
            <Button
              type="submit"
              disabled={isRegisterLoading || !isValid || isValidating}
              className="w-full h-12 text-white font-semibold rounded-xl transition-all"
              style={{
                background: isRegisterLoading || !isValid || isValidating ? "#e8a882" : "#d4825a",
                fontSize: "0.95rem",
              }}
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
            <p className="text-sm" style={{ color: "#5a5a5a" }}>
              Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="font-semibold hover:underline"
                style={{ color: "#d4825a" }}
              >
                Inicia sesion aqui
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#5a5a5a" }}>
          Al crear una cuenta aceptas automaticamente nuestros terminos de servicio
        </p>
      </div>
    </div>
  );
}
