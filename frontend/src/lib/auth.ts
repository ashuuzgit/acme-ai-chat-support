import Cookies from "js-cookie";

const TOKEN_KEY = "token";
const COOKIE_OPTIONS = {
  expires: 7,
  sameSite: "lax" as const,
  secure: typeof window !== "undefined" && window.location.protocol === "https:",
};

export function saveToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function removeToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
