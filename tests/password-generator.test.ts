import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SeedWordError,
  generatePassphrase,
  generatePasswordFromWord,
  suggestSeedWord,
  validateSeedWord,
} from "@/lib/password-generator";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password-policy";
import { COMMON_PASSWORDS } from "@/lib/common-passwords";
import { WORDLIST_ES } from "@/lib/wordlist-es";

afterEach(() => vi.restoreAllMocks());

describe("generador de contraseñas", () => {
  it("la contraseña de personal cumple longitud y composición", () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePasswordFromWord("ventana", "staff");
      expect(password.length).toBeGreaterThanOrEqual(15);
      expect(password).toMatch(/^Ventana[-_.+]\d{4}[-_.+][a-zA-Z2-9]{5}$/);
      // Pasa la política completa, sin necesidad de marcarla como generada.
      expect(validateNewPassword(password, "staff")).toBeNull();
    }
  });

  it("la contraseña del portal cumple longitud y composición", () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePasswordFromWord("faro", "portal");
      expect(password).toMatch(/^Faro[-_.+]\d{6}$/);
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH.portal);
      expect(validateNewPassword(password, "portal")).toBeNull();
    }
  });

  it("dos invocaciones con la misma palabra producen contraseñas distintas", () => {
    const generated = new Set(
      Array.from({ length: 100 }, () => generatePasswordFromWord("ventana", "staff"))
    );
    expect(generated.size).toBe(100);
  });

  it("no usa Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    generatePasswordFromWord("ventana", "staff");
    generatePasswordFromWord("ventana", "portal");
    generatePassphrase();
    suggestSeedWord();
    expect(spy).not.toHaveBeenCalled();
  });

  it("rechaza una palabra muy corta o muy larga", () => {
    expect(validateSeedWord("sol")).not.toBeNull();
    expect(validateSeedWord("a".repeat(13))).not.toBeNull();
    expect(() => generatePasswordFromWord("sol", "staff")).toThrow(SeedWordError);
  });

  it("rechaza palabras que no sean solo a-z", () => {
    for (const word of ["Ventana", "niño", "camión", "casa1", "mi casa", "casa-azul", ""]) {
      expect(validateSeedWord(word), word).not.toBeNull();
    }
  });

  it("rechaza una palabra que está entre las contraseñas más comunes", () => {
    for (const word of ["password", "dragon", "qwerty", "monkey"]) {
      expect(COMMON_PASSWORDS.has(word)).toBe(true);
      expect(validateSeedWord(word), word).toMatch(/demasiado común/);
      expect(() => generatePasswordFromWord(word, "staff")).toThrow(SeedWordError);
    }
  });

  it("rechaza el nombre, el correo y el dominio del usuario, y la empresa", () => {
    const context = { fullName: "José Pérez Quispe", email: "jperez@ascensores.pe" };
    for (const word of ["jose", "perez", "quispe", "jperez", "ascensores"]) {
      expect(validateSeedWord(word, context), word).toMatch(/nombre, el correo/);
    }
    expect(validateSeedWord("ventana", context)).toBeNull();
    expect(validateSeedWord("htlperu")).toMatch(/empresa/);
  });

  it("la frase tiene 4 palabras distintas de la lista y 2 dígitos", () => {
    for (let i = 0; i < 100; i++) {
      const phrase = generatePassphrase();
      const parts = phrase.split("-");
      expect(parts).toHaveLength(5);
      expect(parts[4]).toMatch(/^\d{2}$/);
      const words = parts.slice(0, 4).map((word) => word.toLowerCase());
      expect(new Set(words).size).toBe(4);
      for (const word of words) expect(WORDLIST_ES).toContain(word);
      expect(validateNewPassword(phrase, "staff")).toBeNull();
    }
  });

  it("la palabra sugerida siempre es una semilla válida", () => {
    for (let i = 0; i < 100; i++) {
      expect(validateSeedWord(suggestSeedWord())).toBeNull();
    }
  });
});

describe("lista de palabras en español", () => {
  it("tiene unas 500 palabras, únicas, de 4 a 10 letras a-z", () => {
    expect(WORDLIST_ES.length).toBeGreaterThanOrEqual(500);
    expect(new Set(WORDLIST_ES).size).toBe(WORDLIST_ES.length);
    for (const word of WORDLIST_ES) expect(word).toMatch(/^[a-z]{4,10}$/);
  });

  it("ninguna está entre las contraseñas comunes ni menciona a la empresa", () => {
    for (const word of WORDLIST_ES) {
      expect(COMMON_PASSWORDS.has(word), word).toBe(false);
      expect(word.includes("htl"), word).toBe(false);
    }
  });
});

describe("política de contraseñas", () => {
  it("personal: mínimo 10 caracteres; portal: mínimo 6", () => {
    expect(validateNewPassword("Abc-12345", "staff")).toMatch(/al menos 10/);
    expect(validateNewPassword("Abc-123456", "staff")).toBeNull();
    expect(validateNewPassword("Ab-12", "portal")).toMatch(/al menos 6/);
    expect(validateNewPassword("Ab-123", "portal")).toBeNull();
  });

  it("rechaza contraseñas comunes sin distinguir mayúsculas", () => {
    expect(validateNewPassword("1234567890", "staff")).toMatch(/demasiado común/);
    expect(validateNewPassword("PASSWORD", "portal")).toMatch(/demasiado común/);
  });

  it("exige composición solo a las escritas a mano", () => {
    const lowercaseOnly = "ventanaabiertaazul";
    expect(validateNewPassword(lowercaseOnly, "staff")).toMatch(/Combina/);
    expect(validateNewPassword(lowercaseOnly, "staff", { generated: true })).toBeNull();
  });

  it("marcarla como generada no exime de longitud ni de la lista común", () => {
    expect(validateNewPassword("Abc-1", "staff", { generated: true })).toMatch(/al menos 10/);
    expect(validateNewPassword("1234567890", "staff", { generated: true })).toMatch(/demasiado común/);
  });
});
