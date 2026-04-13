import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery, buildBinMeta } from "@/lib/bin";
import { clearDashboardCache } from "@/lib/redis";

export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const payload = await request.json();

    await connectDB();
    const existing = await Person.findOne({ _id: id, userId: user._id, ...activeQuery() });
    if (!existing) return fail("Person not found", 404);

    const person = await Person.findOneAndUpdate(
      { _id: id, userId: user._id, ...activeQuery() },
      {
        name: payload.name?.trim(),
        email: payload.email?.trim().toLowerCase() || "",
        phone: payload.phone?.trim() || "",
      },
      { new: true }
    );

    if (!person) return fail("Person not found", 404);

    if (existing.name !== person.name) {
      await Transaction.updateMany(
        { userId: user._id, personId: person._id, ...activeQuery() },
        {
          $push: {
            changeLogs: {
              action: "person_name_changed",
              message: `Person name changed from ${existing.name} to ${person.name} on ${new Date().toLocaleString()}`,
              at: new Date(),
            },
          },
        }
      );
    }

    await clearDashboardCache(user._id);
    await logActivity(user._id, "person_updated", `Updated ${person.name}`);
    return ok({ person });
  } catch {
    return fail("Failed to update person", 500);
  }
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    const { deletedAt, restoreUntil } = buildBinMeta();
    const eventAt = new Date();

    const person = await Person.findOneAndUpdate(
      { _id: id, userId: user._id, ...activeQuery() },
      { $set: { isDeleted: true, deletedAt, restoreUntil } },
      { new: true }
    );
    if (!person) return fail("Person not found", 404);

    await Transaction.updateMany(
      { userId: user._id, personId: person._id, ...activeQuery() },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          lastDeletedAt: eventAt,
          restoreUntil,
          deletionSource: "person_bin",
        },
        $push: {
          changeLogs: {
            action: "deleted",
            message: `Transaction deleted at ${eventAt.toLocaleString()}`,
            at: eventAt,
          },
        },
      }
    );

    await clearDashboardCache(user._id);
    await logActivity(user._id, "person_deleted", `Moved ${person.name} to bin`);
    return ok({ message: "Person moved to bin" });
  } catch (caughtError) {
    console.error("Person delete error:", caughtError);
    const message =
      process.env.NODE_ENV === "development"
        ? caughtError?.message || "Failed to delete person"
        : "Failed to delete person";
    return fail(message, 500);
  }
}
