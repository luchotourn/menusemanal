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
import {
  AuthLayout,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth-layout";

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

  const errorClass = "text-sm text-tomate-texto";
  const eyeButtonClass =
    "absolute right-3 top-3 text-muted-foreground hover:text-tinta transition-colors";

  return (
    <AuthLayout
      title="Creá tu cuenta"
      hint="Registrate en menos de un minuto. Es gratis."
      footer="Al crear una cuenta aceptás los términos de servicio y la política de privacidad."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className={authLabelClass}>
            Nombre completo
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre completo"
            className={authInputClass}
            {...register("fullName")}
            aria-invalid={errors.fullName ? "true" : undefined}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
          />
          {errors.fullName && (
            <p id="fullName-error" className={errorClass} role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className={authLabelClass}>
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            className={authInputClass}
            {...register("email")}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className={errorClass} role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className={authLabelClass}>
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tu contraseña"
              className={`${authInputClass} pr-12`}
              {...register("password", {
                onChange: () => {
                  if (confirmPassword) {
                    trigger("confirmPassword");
                  }
                }
              })}
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              type="button"
              className={eyeButtonClass}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className={errorClass} role="alert">
              {errors.password.message}
            </p>
          )}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className={authLabelClass}>
            Confirmar contraseña
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repetí tu contraseña"
              className={`${authInputClass} pr-12`}
              {...register("confirmPassword")}
              aria-invalid={errors.confirmPassword ? "true" : undefined}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            />
            <button
              type="button"
              className={eyeButtonClass}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className={errorClass} role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label htmlFor="role" className={authLabelClass}>
            Tu rol en la familia
          </Label>
          <Select value={role} onValueChange={(value: "creator" | "commentator") => setValue("role", value)}>
            <SelectTrigger id="role" className={authInputClass}>
              <SelectValue placeholder="Elegí tu rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="creator">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Planificador/a</span>
                  <span className="text-xs text-muted-foreground">Crea y edita los planes de comida</span>
                </div>
              </SelectItem>
              <SelectItem value="commentator">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Comensal</span>
                  <span className="text-xs text-muted-foreground">Ve los planes y deja comentarios</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p id="role-error" className={errorClass} role="alert">
              {errors.role.message}
            </p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="acceptTerms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setValue("acceptTerms", !!checked)}
            className="mt-1 h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-cobalto data-[state=checked]:bg-cobalto data-[state=checked]:border-cobalto"
          />
          <Label htmlFor="acceptTerms" className="text-sm cursor-pointer leading-relaxed text-tinta font-medium">
            Acepto los{" "}
            <Link href="#" className="font-bold text-cobalto hover:underline">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link href="#" className="font-bold text-cobalto hover:underline">
              política de privacidad
            </Link>
          </Label>
        </div>
        {errors.acceptTerms && (
          <p id="acceptTerms-error" className={errorClass} role="alert">
            {errors.acceptTerms.message}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isRegisterLoading || !isValid || isValidating}
          className={authPrimaryButtonClass}
        >
          {isRegisterLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creando cuenta…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Crear cuenta
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-bold text-cobalto hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
