import SubscriptionPayment from "@/models/SubscriptionPayment";

export async function recordSubscriptionEvent(userId, event) {
  try {
    await SubscriptionPayment.create({ userId, ...event });
  } catch (error) {
    console.error("Failed to record subscription event:", error);
  }
}
