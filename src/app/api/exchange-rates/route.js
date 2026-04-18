import { getUsdRatesForUsage } from "@/lib/exchangeRates";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    const rates = await getUsdRatesForUsage();
    return ok({ rates });
  } catch (error) {
    console.error("Exchange rates fetch error:", error);
    return fail("Failed to load exchange rates", 500);
  }
}
