import { verifyToken, getUserById } from "../services/authService.js";

const COOKIE_NAME = "token";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const payload = verifyToken(token);
    const user = await getUserById(payload.id);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Não autenticado" });
  }
}

export function requireRole(...papeis) {
  return (req, res, next) => {
    if (!req.user || !papeis.includes(req.user.papel)) {
      return res.status(403).json({ error: "Acesso não permitido para este papel" });
    }
    next();
  };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
