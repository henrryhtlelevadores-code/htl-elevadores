import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { MAX_IMAGE_BYTES, detectImageType, validateImageUpload } from "@/lib/image-validation";
import { isCrossOriginMutation } from "@/lib/csrf";
import { proxy } from "@/proxy";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const bytes = (values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("validación de imágenes por contenido", () => {
  it("acepta JPEG, PNG y WebP por sus magic bytes", () => {
    expect(detectImageType(bytes(JPEG))).toEqual({ contentType: "image/jpeg", extension: "jpg" });
    expect(detectImageType(bytes(PNG))).toEqual({ contentType: "image/png", extension: "png" });
    expect(detectImageType(bytes(WEBP))).toEqual({ contentType: "image/webp", extension: "webp" });
  });

  it("rechaza SVG", () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(detectImageType(svg)).toBeNull();
    expect(validateImageUpload(svg)).toMatchObject({ ok: false });
  });

  it("rechaza un archivo renombrado que no es una imagen", () => {
    // Lo que el cliente declare (nombre .png, Content-Type image/png) da
    // igual: solo cuentan los bytes.
    for (const fake of [text("<html><script>alert(1)</script></html>"), text("%PDF-1.7"), text("MZ\x90\x00"), text("GIF89a")]) {
      expect(validateImageUpload(fake)).toMatchObject({ ok: false });
    }
  });

  it("rechaza un RIFF que no es WebP", () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
    expect(detectImageType(bytes(wav))).toBeNull();
  });

  it("rechaza archivos vacíos y los que superan 5 MB", () => {
    expect(validateImageUpload(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(JPEG);
    expect(validateImageUpload(big)).toMatchObject({ ok: false });
    const fits = new Uint8Array(MAX_IMAGE_BYTES);
    fits.set(JPEG);
    expect(validateImageUpload(fits)).toMatchObject({ ok: true });
  });
});

describe("verificación de origen (CSRF)", () => {
  const base = { host: "app.example.com", origin: null, secFetchSite: null };

  it("deja pasar lecturas de cualquier origen", () => {
    expect(isCrossOriginMutation({ ...base, method: "GET", origin: "https://evil.example" })).toBe(false);
  });

  it("acepta mutaciones del propio origen", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: "https://app.example.com" })).toBe(false);
  });

  it("rechaza mutaciones con Origin ajeno, de subdominio hermano o null", () => {
    for (const origin of ["https://evil.example", "https://otra.example.com", "https://app.example.com.evil.io", "null", "basura"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(isCrossOriginMutation({ ...base, method, origin }), `${method} ${origin}`).toBe(true);
      }
    }
  });

  it("sin Origin se apoya en Sec-Fetch-Site", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", secFetchSite: "cross-site" })).toBe(true);
    expect(isCrossOriginMutation({ ...base, method: "POST", secFetchSite: "same-origin" })).toBe(false);
    // Sin ninguna de las dos cabeceras no es un navegador.
    expect(isCrossOriginMutation({ ...base, method: "POST" })).toBe(false);
  });

  it("el proxy responde 403 a un POST con Origin ajeno, también en /api", () => {
    for (const path of ["/api/quotations/X/images", "/login", "/clients"]) {
      const response = proxy(
        new NextRequest(`https://app.example.com${path}`, {
          method: "POST",
          headers: { host: "app.example.com", origin: "https://evil.example" },
        })
      );
      expect(response.status, path).toBe(403);
    }
  });

  it("el proxy deja pasar un POST del propio origen a /api", () => {
    const response = proxy(
      new NextRequest("https://app.example.com/api/quotations/X/images", {
        method: "POST",
        headers: { host: "app.example.com", origin: "https://app.example.com" },
      })
    );
    expect(response.status).toBe(200);
  });
});

describe("proxy: rutas del portal", () => {
  const get = (path: string) => proxy(new NextRequest(`https://app.example.com${path}`));

  it("el login del portal es accesible sin sesión", () => {
    expect(get("/portal/CENTRO-1/login").status).toBe(200);
  });

  it("sin sesión, el portal redirige a SU login y no al de personal", () => {
    const response = get("/portal/CENTRO-1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/portal/CENTRO-1/login");
  });

  it("sin sesión, el panel redirige al login de personal", () => {
    const response = get("/clients");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/login?next=%2Fclients");
  });
});
