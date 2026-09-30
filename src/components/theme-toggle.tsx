"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function ThemeToggle({
  size = "icon",
  className,
}: {
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      title="Cambiar tema"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
