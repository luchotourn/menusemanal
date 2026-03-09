import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { useAuth } from "@/hooks/useAuth";
import { loginSchema, type LoginFormData } from "@shared/schema";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoginLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#faf9f7",
      }}
    >
      <div className="w-full max-w-md space-y-8">
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
            <span>&#x1F37D;&#xFE0F;</span>
            Planifica las comidas de tu familia
          </div>
        </div>

        {/* Login Card - warm landing page style */}
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
              Iniciar Sesion
            </h2>
            <p className="text-sm" style={{ color: "#5a5a5a" }}>
              Ingresa a tu cuenta para acceder a tus planes de comida
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                style={{
                  border: "1.5px solid #e8e2db",
                  background: "#faf9f7",
                  fontSize: "1rem",
                }}
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
                  style={{
                    border: "1.5px solid #e8e2db",
                    background: "#faf9f7",
                    fontSize: "1rem",
                  }}
                  {...register("password")}
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
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setValue("rememberMe", !!checked)}
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm cursor-pointer"
                style={{ color: "#1a1a1a" }}
              >
                Recordarme
              </Label>
            </div>

            {/* Submit Button - matching landing page CTA */}
            <Button
              type="submit"
              disabled={isLoginLoading || !isValid}
              className="w-full h-12 text-white font-semibold rounded-xl transition-all"
              style={{
                background: isLoginLoading || !isValid ? "#e8a882" : "#d4825a",
                fontSize: "0.95rem",
              }}
            >
              {isLoginLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando sesion...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Iniciar Sesion</span>
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </Button>
          </form>

        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#5a5a5a" }}>
          Al iniciar sesion aceptas nuestros terminos de servicio y politica de privacidad
        </p>
      </div>
    </div>
  );
}
