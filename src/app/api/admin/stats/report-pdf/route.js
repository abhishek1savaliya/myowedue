import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminSession";
import { fail } from "@/lib/api";
import { buildSuperadminStatsBundle } from "@/lib/buildSuperadminStatsBundle";
import { buildSuperadminAnalyticsPdfBuffer } from "@/lib/superadminReportPdf";

export const runtime = "nodejs";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") {
    return fail("Forbidden", 403);
  }

  try {
    const bundle = await buildSuperadminStatsBundle();
    const buffer = await buildSuperadminAnalyticsPdfBuffer(bundle, {
      name: admin.name,
      email: admin.email,
    });

    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = `myowedue-executive-report-${safeDate}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Admin stats PDF error:", err);
    return fail("Could not generate report", 500);
  }
}
