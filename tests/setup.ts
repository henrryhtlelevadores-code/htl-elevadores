import { vi } from "vitest";
import { cookieJar, requestHeaders } from "./helpers/request";

// Sustitutos de las APIs de Next que solo existen dentro de una petición.

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
  headers: async () => requestHeaders,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { redirectTo: url });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
