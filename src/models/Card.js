import mongoose, { Schema } from "mongoose";

const CardSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cardTypeValue: { type: String, required: true, trim: true },
    cardTypeLabel: { type: String, required: true, trim: true },
    issuingCountryCode: { type: String, required: true, trim: true, uppercase: true },
    issuingCountryName: { type: String, required: true, trim: true },
    issuingBankKey: { type: String, required: true, trim: true },
    issuingBankName: { type: String, required: true, trim: true },
    variantValue: { type: String, required: true, trim: true },
    variantLabel: { type: String, required: true, trim: true },
    network: { type: String, required: true, trim: true },
    nameOnCard: { type: String, trim: true, default: "" },
    encryptedCardNumber: { type: String, trim: true, default: "" },
    last4: { type: String, required: true, trim: true },
    cardNumberLength: { type: Number, required: true, min: 12, max: 19 },
    expiryMonth: { type: String, required: true, trim: true },
    expiryYear: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

CardSchema.index({ userId: 1, createdAt: -1 });
CardSchema.index({ userId: 1, issuingCountryCode: 1, issuingBankKey: 1 });

let Card;

if (mongoose.models.Card) {
  Card = mongoose.models.Card;
  const missingPaths = {};
  if (!Card.schema.path("encryptedCardNumber")) missingPaths.encryptedCardNumber = { type: String, trim: true, default: "" };
  if (!Card.schema.path("last4")) missingPaths.last4 = { type: String, required: true, trim: true, default: "" };
  if (!Card.schema.path("cardNumberLength")) missingPaths.cardNumberLength = { type: Number, required: true, min: 12, max: 19, default: 16 };
  if (!Card.schema.path("expiryMonth")) missingPaths.expiryMonth = { type: String, required: true, trim: true, default: "" };
  if (!Card.schema.path("expiryYear")) missingPaths.expiryYear = { type: String, required: true, trim: true, default: "" };

  if (Object.keys(missingPaths).length > 0) {
    Card.schema.add(missingPaths);
  }
} else {
  Card = mongoose.model("Card", CardSchema);
}

export default Card;
