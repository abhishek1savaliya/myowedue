import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminSession";
import { fail } from "@/lib/api";
import { enqueuePdf } from "@/lib/queue/producers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") {
    return fail("Forbidden", 403);
  }

  try {
    const jobId = await enqueuePdf("admin-report", {
      type: "admin-report",
      adminName: admin.name,
      adminEmail: admin.email,
    });
    if (jobId) {
      return Response.json({ jobId, status: "processing" }, { status: 202 });
    }

    // Lazy-import so `next build` page-data collection does not load pdfkit.
    const { buildSuperadminStatsBundle } = await import("@/lib/buildSuperadminStatsBundle");
    const { buildSuperadminAnalyticsPdfBuffer } = await import("@/lib/superadminReportPdf");

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
