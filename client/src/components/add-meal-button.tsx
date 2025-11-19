import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddMealButtonProps {
  // Core functionality
  onClick: () => void;

  // Label customization
  label?: string;
  showIcon?: boolean;
  iconPosition?: "left" | "right";

  // Border customization
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  borderWidth?: "1" | "2" | "3" | "4";
  borderColor?: string; // Tailwind color class (e.g., "gray-400", "orange-500")
  borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

  // Color customization
  textColor?: string; // Tailwind color class
  backgroundColor?: string; // Tailwind color class

  // Hover state customization
  hoverBorderColor?: string; // Tailwind color class
  hoverTextColor?: string; // Tailwind color class
  hoverBackgroundColor?: string; // Tailwind color class

  // Padding customization
  padding?: {
    x?: string; // horizontal padding (e.g., "4", "6", "8")
    y?: string; // vertical padding (e.g., "2", "3", "4")
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };

  // Size customization
  fontSize?: "xs" | "sm" | "base" | "lg" | "xl";
  fullWidth?: boolean;
  minHeight?: string; // e.g., "44px" for touch targets

  // Variant presets (optional - overrides individual props if set)
  variant?: "default" | "empty" | "append" | "primary" | "secondary";

  // Additional customization
  className?: string;
  disabled?: boolean;

  // Accessibility
  ariaLabel?: string;
}

export function AddMealButton({
  onClick,
  label = "Agregar nuevo +",
  showIcon = false,
  iconPosition = "left",
  borderStyle = "dashed",
  borderWidth = "1",
  borderColor = "gray-400",
  borderRadius = "lg",
  textColor = "gray-600",
  backgroundColor = "transparent",
  hoverBorderColor = "app-accent",
  hoverTextColor = "app-accent",
  hoverBackgroundColor = "orange-50/50",
  padding,
  fontSize = "sm",
  fullWidth = true,
  minHeight,
  variant,
  className,
  disabled = false,
  ariaLabel,
}: AddMealButtonProps) {
  // Variant presets
  const variantStyles = {
    default: {
      borderStyle: "dashed" as const,
      borderWidth: "1" as const,
      borderColor: "gray-400",
      textColor: "gray-600",
      backgroundColor: "transparent",
      hoverBorderColor: "app-accent",
      hoverTextColor: "app-accent",
      hoverBackgroundColor: "orange-50/50",
      padding: { x: "4", y: "2" },
      fontSize: "sm" as const,
    },
    empty: {
      borderStyle: "dashed" as const,
      borderWidth: "2" as const,
      borderColor: "gray-300",
      textColor: "gray-500",
      backgroundColor: "white",
      hoverBorderColor: "app-accent",
      hoverTextColor: "app-accent",
      hoverBackgroundColor: "orange-50",
      padding: { x: "6", y: "4" },
      fontSize: "sm" as const,
      showIcon: true,
    },
    append: {
      borderStyle: "dashed" as const,
      borderWidth: "1" as const,
      borderColor: "gray-300",
      textColor: "gray-500",
      backgroundColor: "transparent",
      hoverBorderColor: "orange-400",
      hoverTextColor: "orange-600",
      hoverBackgroundColor: "orange-50/30",
      padding: { x: "3", y: "1.5" },
      fontSize: "xs" as const,
    },
    primary: {
      borderStyle: "solid" as const,
      borderWidth: "2" as const,
      borderColor: "app-accent",
      textColor: "app-accent",
      backgroundColor: "white",
      hoverBorderColor: "orange-600",
      hoverTextColor: "white",
      hoverBackgroundColor: "app-accent",
      padding: { x: "6", y: "3" },
      fontSize: "base" as const,
    },
    secondary: {
      borderStyle: "solid" as const,
      borderWidth: "1" as const,
      borderColor: "gray-300",
      textColor: "gray-700",
      backgroundColor: "gray-50",
      hoverBorderColor: "gray-400",
      hoverTextColor: "gray-900",
      hoverBackgroundColor: "gray-100",
      padding: { x: "4", y: "2" },
      fontSize: "sm" as const,
    },
  };

  // Apply variant preset if specified
  const appliedVariant = variant ? variantStyles[variant] : null;

  const finalBorderStyle = appliedVariant?.borderStyle ?? borderStyle;
  const finalBorderWidth = appliedVariant?.borderWidth ?? borderWidth;
  const finalBorderColor = appliedVariant?.borderColor ?? borderColor;
  const finalTextColor = appliedVariant?.textColor ?? textColor;
  const finalBackgroundColor = appliedVariant?.backgroundColor ?? backgroundColor;
  const finalHoverBorderColor = appliedVariant?.hoverBorderColor ?? hoverBorderColor;
  const finalHoverTextColor = appliedVariant?.hoverTextColor ?? hoverTextColor;
  const finalHoverBackgroundColor = appliedVariant?.hoverBackgroundColor ?? hoverBackgroundColor;
  const finalPadding = appliedVariant?.padding ?? padding ?? { x: "4", y: "2" };
  const finalFontSize = appliedVariant?.fontSize ?? fontSize;
  const finalShowIcon = appliedVariant?.showIcon ?? showIcon;

  // Build padding classes
  const paddingClasses = finalPadding.top || finalPadding.bottom || finalPadding.left || finalPadding.right
    ? `${finalPadding.top ? `pt-${finalPadding.top}` : ""} ${finalPadding.bottom ? `pb-${finalPadding.bottom}` : ""} ${finalPadding.left ? `pl-${finalPadding.left}` : ""} ${finalPadding.right ? `pr-${finalPadding.right}` : ""}`
    : `px-${finalPadding.x || "4"} py-${finalPadding.y || "2"}`;

  // Build border classes
  const borderClasses = `border-${finalBorderWidth} border-${finalBorderStyle} border-${finalBorderColor}`;

  // Build text and background classes
  const colorClasses = `text-${finalTextColor} bg-${finalBackgroundColor}`;

  // Build hover classes
  const hoverClasses = `hover:border-${finalHoverBorderColor} hover:text-${finalHoverTextColor} hover:bg-${finalHoverBackgroundColor}`;

  // Build size classes
  const sizeClasses = `text-${finalFontSize} ${fullWidth ? "w-full" : "w-auto"}`;

  // Build border radius class
  const radiusClass = borderRadius === "none" ? "" : `rounded-${borderRadius}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      style={minHeight ? { minHeight } : undefined}
      className={cn(
        // Base styles
        "flex items-center justify-center gap-2",
        "cursor-pointer transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2",

        // Applied customizations
        paddingClasses,
        borderClasses,
        colorClasses,
        hoverClasses,
        sizeClasses,
        radiusClass,

        // Disabled state
        disabled && "opacity-50 cursor-not-allowed hover:border-gray-400 hover:text-gray-600 hover:bg-transparent",

        // Additional custom classes
        className
      )}
    >
      {finalShowIcon && iconPosition === "left" && (
        <Plus className="w-3 h-3 flex-shrink-0" />
      )}

      <span className="font-normal">{label}</span>

      {finalShowIcon && iconPosition === "right" && (
        <Plus className="w-3 h-3 flex-shrink-0" />
      )}
    </button>
  );
}
