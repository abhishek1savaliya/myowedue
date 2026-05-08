import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import Folder from "@/models/Folder";
import FolderPassword from "@/models/FolderPassword";

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();

    // Verify folder belongs to user
    const folder = await Folder.findOne({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    const passwords = await FolderPassword.find({ folderId: id }).select("_id hint createdAt").lean();

    return ok({
      passwords: passwords.map((p) => ({
        id: p._id.toString(),
        hint: p.hint || "",
        createdAt: p.createdAt,
      })),
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to get folder passwords", 500);
  }
}

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "").trim();
    const hint = String(body.hint || "").trim();

    if (!password) {
      return fail("Password is required", 422);
    }

    if (password.length < 4) {
      return fail("Password must be at least 4 characters", 422);
    }

    await connectDB();

    // Verify folder belongs to user
    const folder = await Folder.findOne({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    const passwordHash = await hashPassword(password);

    const folderPassword = await FolderPassword.create({
      folderId: id,
      passwordHash,
      hint: hint.slice(0, 100),
    });

    if (folder.permissionType !== "password") {
      folder.permissionType = "password";
      await folder.save();
    }

    await Promise.all([
      clearUserApiCache(user._id),
      logActivity(user._id, "folder_password_created", `Added password to folder: ${folder.name}`),
    ]);

    return ok(
      {
        password: {
          id: folderPassword._id.toString(),
          hint: folderPassword.hint,
          createdAt: folderPassword.createdAt,
        },
        message: "Password added to folder successfully",
      },
      201
    );
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to add password to folder", 500);
  }
}
