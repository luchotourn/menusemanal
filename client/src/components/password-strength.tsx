import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: number;
  feedback: string[];
  color: string;
  label: string;
}

export function PasswordStrength({ password, className = "" }: PasswordStrengthProps) {
  const strength = useMemo((): StrengthResult => {
    if (!password) {
      return {
        score: 0,
        feedback: [],
        color: "bg-gray-300",
        label: ""
      };
    }

    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 8) {
      score += 20;
    } else {
      feedback.push("Al menos 8 caracteres");
    }

    // Lowercase letter
    if (/[a-z]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Una letra minúscula");
    }

    // Uppercase letter
    if (/[A-Z]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Una letra mayúscula");
    }

    // Number
    if (/[0-9]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Un número");
    }

    // Special character
    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 20;
      feedback.unshift("¡Excelente! Incluye símbolos especiales");
    }

    // Bonus for longer passwords
    if (password.length >= 12) {
      score += 10;
    }

    // Determine color and label based on score
    let color: string;
    let label: string;

    if (score < 40) {
      color = "bg-red-500";
      label = "Débil";
    } else if (score < 60) {
      color = "bg-yellow-500";
      label = "Regular";
    } else if (score < 80) {
      color = "bg-blue-500";
      label = "Buena";
    } else {
      color = "bg-green-500";
      label = "Fuerte";
    }

    return {
      score: Math.min(100, score),
      feedback,
      color,
      label
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className={`space-y-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-app-neutral">Fortaleza de la contraseña:</span>
        <span className={`font-medium ${
          strength.score < 40 ? "text-red-600" :
          strength.score < 60 ? "text-yellow-600" :
          strength.score < 80 ? "text-blue-600" : "text-green-600"
        }`}>
          {strength.label}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
          style={{ width: `${strength.score}%` }}
          aria-label={`Fortaleza de contraseña: ${strength.score}%`}
        />
      </div>

      {strength.feedback.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1">
          {strength.feedback[0]?.startsWith("¡Excelente!") ? (
            <p className="text-green-600 font-medium">{strength.feedback[0]}</p>
          ) : (
            <>
              <p>Necesita:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                {strength.feedback.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}