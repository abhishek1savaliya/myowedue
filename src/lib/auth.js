import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function safeUser(user) {
  const fromName = splitName(user.name);
  const firstName = user.firstName || fromName.firstName;
  const lastName = user.lastName || fromName.lastName;
  const displayName = `${firstName} ${lastName}`.trim() || user.name || "User";

  return {
    id: user._id.toString(),
    firstName,
    lastName,
    name: displayName,
    email: user.email,
    phone: user.phone || "",
    joinDate: user.createdAt,
    reminderFrequency: user.reminderFrequency || "weekly",
    darkMode: Boolean(user.darkMode),
  };
}
