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
    lookupBin: { type: String, trim: true, minlength: 6, maxlength: 8, default: "" },
    nameOnCard: { type: String, trim: true, default: "" },
    encryptedNameOnCard: { type: String, trim: true, default: "" },
    encryptedCardNumber: { type: String, trim: true, default: "" },
    // --- Added CVV Field ---
    encryptedCvv: { type: String, trim: true, default: "" },
    // -----------------------
    last4: { type: String, required: true, trim: true },
    cardNumberLength: { type: Number, required: true, min: 12, max: 19 },
    expiryMonth: { type: String, trim: true, default: "" },
    expiryYear: { type: String, trim: true, default: "" },
    encryptedExpiryMonth: { type: String, trim: true, default: "" },
    encryptedExpiryYear: { type: String, trim: true, default: "" },
    encryptedPrivateNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

CardSchema.index({ userId: 1, createdAt: -1 });
CardSchema.index({ userId: 1, issuingCountryCode: 1, issuingBankKey: 1 });
CardSchema.index({ lookupBin: 1, updatedAt: -1 });

let Card;

if (mongoose.models.Card) {
  Card = mongoose.models.Card;

  const missingPaths = {};

  // Logic to add missing paths to existing model
  if (!Card.schema.path("lookupBin")) missingPaths.lookupBin = { type: String, trim: true, minlength: 6, maxlength: 8, default: "" };
  if (!Card.schema.path("encryptedNameOnCard")) missingPaths.encryptedNameOnCard = { type: String, trim: true, default: "" };
  if (!Card.schema.path("encryptedCardNumber")) missingPaths.encryptedCardNumber = { type: String, trim: true, default: "" };

  // Ensure encryptedCvv is added to existing models in memory
  if (!Card.schema.path("encryptedCvv")) missingPaths.encryptedCvv = { type: String, trim: true, default: "" };

  if (!Card.schema.path("last4")) missingPaths.last4 = { type: String, required: true, trim: true, default: "" };
  if (!Card.schema.path("cardNumberLength")) missingPaths.cardNumberLength = { type: Number, required: true, min: 12, max: 19, default: 16 };
  if (!Card.schema.path("expiryMonth")) missingPaths.expiryMonth = { type: String, trim: true, default: "" };
  if (!Card.schema.path("expiryYear")) missingPaths.expiryYear = { type: String, trim: true, default: "" };
  if (!Card.schema.path("encryptedExpiryMonth")) missingPaths.encryptedExpiryMonth = { type: String, trim: true, default: "" };
  if (!Card.schema.path("encryptedExpiryYear")) missingPaths.encryptedExpiryYear = { type: String, trim: true, default: "" };
  if (!Card.schema.path("encryptedPrivateNote")) missingPaths.encryptedPrivateNote = { type: String, trim: true, default: "" };

  if (Object.keys(missingPaths).length > 0) {
    Card.schema.add(missingPaths);
  }
} else {
  Card = mongoose.model("Card", CardSchema);
}

export default Card;