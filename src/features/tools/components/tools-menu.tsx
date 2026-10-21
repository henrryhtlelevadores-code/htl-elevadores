"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  IconCalculator,
  IconCategory,
  IconNotes,
} from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FloatingCalculator } from "./floating-calculator";
import { FloatingNotepad } from "./floating-notepad";

type ToolKey = "calculator" | "notepad";

export function ToolsMenu() {
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [notepadZ, setNotepadZ] = useState(30);
  const [calculatorZ, setCalculatorZ] = useState(31);
  const nextZ = useRef(32);
  const portalReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  function focusTool(tool: ToolKey) {
    const zIndex = nextZ.current++;
    if (tool === "notepad") {
      setNotepadZ(zIndex);
      setNotepadOpen(true);
    } else {
      setCalculatorZ(zIndex);
      setCalculatorOpen(true);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          title="Herramientas"
          aria-label="Abrir herramientas"
        >
          <IconCategory className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => focusTool("notepad")}>
              <IconNotes className="size-4" />
              Bloc de notas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => focusTool("calculator")}>
              <IconCalculator className="size-4" />
              Calculadora
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {portalReady
        ? createPortal(
            <>
              <FloatingNotepad
                isOpen={notepadOpen}
                onClose={() => setNotepadOpen(false)}
                onFocus={() => setNotepadZ(nextZ.current++)}
                zIndex={notepadZ}
              />
              <FloatingCalculator
                isOpen={calculatorOpen}
                onClose={() => setCalculatorOpen(false)}
                onFocus={() => setCalculatorZ(nextZ.current++)}
                zIndex={calculatorZ}
              />
            </>,
            document.body
          )
        : null}
    </>
  );
}
