import { cn } from "@/lib/utils";

/**
 * FrancisAvatar — the brand mascot wherever the UI talks about Francis.
 *
 * Uses the PWA icon assets so the drawing is identical to the home-screen
 * icon. `tile` keeps the app-icon squircle; `circle` uses the maskable export
 * (Francis at 66 %) so the beret survives a circular crop.
 */
interface FrancisAvatarProps {
  size?: number;
  shape?: "tile" | "circle";
  className?: string;
  /** Decorative by default; pass a label when the image is the only signifier. */
  label?: string;
}

export function FrancisAvatar({ size = 32, shape = "tile", className, label }: FrancisAvatarProps) {
  const src = shape === "circle" ? "/icon-maskable-192.png" : "/icon-192.png";
  return (
    <img
      src={src}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("flex-shrink-0 object-cover", shape === "circle" ? "rounded-full" : "rounded-[22%]", className)}
    />
  );
}
