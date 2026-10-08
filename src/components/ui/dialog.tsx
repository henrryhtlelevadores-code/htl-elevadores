"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// Clases que cada diálogo usaba para limitar su altura y hacer scroll de todo
// el popup. En el diseño estructurado las gestiona DialogContent.
const OWN_SCROLL_CLASS = /^(max-h-\S+|overflow-y-auto|overflow-auto)$/;
// Diálogos que traen su propio layout interno (cabecera/cuerpo/pie propios).
const CUSTOM_LAYOUT_CLASS = /(^|\s)(overflow-hidden|p-0|grid-rows-\S+)(\s|$)/;

const POPUP_BASE =
  "fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

// Alto máximo: el viewport visible real del móvil (dvh descuenta las barras
// del navegador) menos un margen y las zonas seguras del dispositivo.
const POPUP_MAX_HEIGHT =
  "max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";

// Un DialogFooter anidado en el cuerpo (p. ej. dentro de un <form>) queda
// pegado al fondo del área de scroll, con fondo opaco.
const NESTED_FOOTER =
  "[&_[data-slot=dialog-footer]]:sticky [&_[data-slot=dialog-footer]]:bottom-0 [&_[data-slot=dialog-footer]]:z-10 [&_[data-slot=dialog-footer]]:mb-0 [&_[data-slot=dialog-footer]]:bg-[color-mix(in_srgb,var(--muted)_50%,var(--popover))]";

/**
 * Contenido del diálogo en tres bloques dentro de una caja que nunca supera
 * la pantalla: cabecera fija, cuerpo con scroll propio y pie fijo.
 *
 * Los `DialogHeader` y `DialogFooter` que sean hijos directos quedan fijos;
 * todo lo demás va al cuerpo con scroll. Un diálogo que ya trae su propio
 * layout (`overflow-hidden`, `p-0` o `grid-rows-*` en su className) se deja
 * tal cual.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const ownClassName = typeof className === "string" ? className : ""
  const customLayout = typeof className !== "string" && className != null
    ? true
    : CUSTOM_LAYOUT_CLASS.test(ownClassName)

  const closeButton = showCloseButton && (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={
        <Button
          variant="ghost"
          className="absolute top-2 right-2"
          size="icon-sm"
        />
      }
    >
      <XIcon
      />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  )

  if (customLayout) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(POPUP_BASE, "grid", className)}
          {...props}
        >
          {children}
          {closeButton}
        </DialogPrimitive.Popup>
      </DialogPortal>
    )
  }

  const items = React.Children.toArray(children)
  const isSlot = (item: React.ReactNode, slot: unknown) =>
    React.isValidElement(item) && item.type === slot
  const headers = items.filter((item) => isSlot(item, DialogHeader))
  const footers = items.filter((item) => isSlot(item, DialogFooter))
  const body = items.filter(
    (item) => !isSlot(item, DialogHeader) && !isSlot(item, DialogFooter)
  )
  const popupClassName = ownClassName
    .split(/\s+/)
    .filter((token) => token && !OWN_SCROLL_CLASS.test(token))
    .join(" ")

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          POPUP_BASE,
          "flex flex-col overflow-hidden",
          POPUP_MAX_HEIGHT,
          popupClassName
        )}
        {...props}
      >
        {headers}
        <div
          data-slot="dialog-body"
          className={cn(
            "-mx-4 grid min-h-0 flex-auto gap-4 overflow-y-auto overscroll-contain px-4",
            NESTED_FOOTER,
            // Sin pie fijo, el cuerpo llega hasta el borde inferior del popup.
            footers.length === 0 &&
              "-mb-4 pb-4 has-[[data-slot=dialog-footer]]:pb-0"
          )}
        >
          {body}
        </div>
        {footers}
        {closeButton}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // El relleno inferior respeta la barra de gestos del sistema.
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
