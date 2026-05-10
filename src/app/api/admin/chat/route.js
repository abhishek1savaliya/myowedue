import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import AdminUser from "@/models/AdminUser";
import AdminMessage from "@/models/AdminMessage";
import {
  canAdminChatWith,
  canAdminViewChatThread,
  maskMessageForSupportViewer,
  serializeChatMessage,
  serializePeerForViewer,
} from "@/lib/adminChat";

export async function GET(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const withId = new URL(req.url).searchParams.get("with");
    if (!withId) return fail("Query \"with\" (peer user id) is required", 400);

    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).lean();
    if (!dbAdmin) return fail("User not found", 404);

    const peer = await AdminUser.findById(withId).lean();
    if (!peer) return fail("Recipient not found", 404);

    if (!canAdminViewChatThread(dbAdmin, peer)) return fail("You cannot open this conversation", 403);

    const messages = await AdminMessage.find({
      $or: [
        { fromAdminId: dbAdmin._id, toAdminId: peer._id },
        { fromAdminId: peer._id, toAdminId: dbAdmin._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("fromAdminId", "name role employeeId")
      .populate("toAdminId", "name role employeeId")
      .lean();

    const thread = messages.reverse().map((m) =>
      maskMessageForSupportViewer(dbAdmin.role, serializeChatMessage(m))
    );

    return ok({
      peer: serializePeerForViewer(dbAdmin.role, peer),
      messages: thread,
    });
  } catch (err) {
    console.error("Admin chat GET error:", err);
    return fail("Internal server error", 500);
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const toAdminId = body.toAdminId || body.to;
    const trimmed = String(body.message || "").trim();
    if (!toAdminId) return fail("Recipient is required", 400);
    if (!trimmed) return fail("Message is required", 400);

    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).lean();
    if (!dbAdmin) return fail("User not found", 404);

    const peer = await AdminUser.findById(toAdminId).lean();
    if (!peer) return fail("Recipient not found", 404);

    if (!canAdminChatWith(dbAdmin, peer)) return fail("You are not allowed to send messages to this user", 403);

    const created = await AdminMessage.create({
      fromAdminId: dbAdmin._id,
      toAdminId: peer._id,
      message: trimmed,
    });

    const populated = await AdminMessage.findById(created._id)
      .populate("fromAdminId", "name role employeeId")
      .populate("toAdminId", "name role employeeId")
      .lean();

    return ok(
      { message: maskMessageForSupportViewer(dbAdmin.role, serializeChatMessage(populated)) },
      201
    );
  } catch (err) {
    console.error("Admin chat POST error:", err);
    return fail("Internal server error", 500);
  }
}
