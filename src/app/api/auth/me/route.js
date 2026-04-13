import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import { safeUser } from "@/lib/auth";
import User from "@/models/User";
import { connectDB } from "@/lib/db";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return ok({ user: safeUser(user) });
}

export async function PUT(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { firstName, lastName, email, phone } = await request.json();

    const nextFirst = String(firstName || "").trim();
    const nextLast = String(lastName || "").trim();
    const nextEmail = String(email || "").toLowerCase().trim();
    const nextPhone = String(phone || "").trim();

    if (!nextFirst || !nextLast || !nextEmail) {
      return fail("First name, last name and email are required", 422);
    }

    await connectDB();

    const duplicate = await User.findOne({
      email: nextEmail,
      _id: { $ne: user._id },
    });
    if (duplicate) {
      return fail("Email already in use", 409);
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          firstName: nextFirst,
          lastName: nextLast,
          name: `${nextFirst} ${nextLast}`.trim(),
          email: nextEmail,
          phone: nextPhone,
        },
      },
      { new: true }
    );

    if (!updated) return fail("User not found", 404);

    return ok({ user: safeUser(updated), message: "Profile updated" });
  } catch {
    return fail("Failed to update profile", 500);
  }
}
