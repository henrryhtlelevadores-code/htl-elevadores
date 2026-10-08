/** Cookies y cabeceras de la "petición" en curso durante un test. */

export interface StoredCookie {
  value: string;
  options: Record<string, unknown>;
}

class CookieJar {
  private readonly store = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const cookie = this.store.get(name);
    return cookie ? { name, value: cookie.value } : undefined;
  }

  set(name: string, value: string, options: Record<string, unknown> = {}) {
    // maxAge 0 es como el navegador interpreta "borrar la cookie".
    if (options.maxAge === 0) this.store.delete(name);
    else this.store.set(name, { value, options });
  }

  /** Para inspeccionar los atributos con los que se fijó. */
  raw(name: string): StoredCookie | undefined {
    return this.store.get(name);
  }

  clear() {
    this.store.clear();
  }
}

export const cookieJar = new CookieJar();
export const requestHeaders = new Headers();

/** Deja la petición sin cookies ni cabeceras: un visitante anónimo. */
export function resetRequest() {
  cookieJar.clear();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
}
