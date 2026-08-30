import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AuthLayout,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  LegalNotice,
} from "@/components/auth-layout";

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
    <AuthLayout
      title="Hola de nuevo"
      hint="Ingresá para ver qué come tu familia esta semana."
      footer={<LegalNotice action="Al iniciar sesión" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
            <p id="email-error" className="text-sm text-tomate-texto" role="alert">
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
              autoComplete="current-password"
              placeholder="Tu contraseña"
              className={`${authInputClass} pr-12`}
              {...register("password")}
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              type="button"
              className="absolute right-3 top-3 text-muted-foreground hover:text-tinta transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-tomate-texto" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setValue("rememberMe", !!checked)}
            className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-cobalto data-[state=checked]:bg-cobalto data-[state=checked]:border-cobalto"
          />
          <Label htmlFor="rememberMe" className="text-sm cursor-pointer text-tinta font-medium">
            Recordarme
          </Label>
        </div>

        {/* Submit */}
        <Button type="submit" disabled={isLoginLoading || !isValid} className={authPrimaryButtonClass}>
          {isLoginLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Iniciando sesión…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Iniciar sesión
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-bold text-cobalto hover:underline">
            Creá una gratis
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
