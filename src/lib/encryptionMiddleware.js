import { getSessionUser } from "@/lib/session";
import { deriveUserKey } from "@/lib/crypto";

/**
 * Middleware to extract and derive user's encryption key
 * Adds userKey to the request for use in encryption/decryption
 */
export async function withEncryption(request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { error: "Unauthorized", status: 401 };
    }

    // Derive user's deterministic encryption key
    const userKey = await deriveUserKey(user._id.toString(), user.email);

    return {
      user,
      userKey,
      error: null,
    };
  } catch (error) {
    return {
      error: error.message || "Failed to derive encryption key",
      status: 500,
    };
  }
}

export default { withEncryption };
