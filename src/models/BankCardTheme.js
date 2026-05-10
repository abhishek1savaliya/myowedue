import mongoose, { Schema } from "mongoose";

const hex6 = /^#[0-9A-Fa-f]{6}$/;

const BankCardThemeSchema = new Schema(
  {
    bankKey: { type: String, required: true, unique: true, trim: true, index: true },
    primaryHex: { type: String, required: true, trim: true, validate: { validator: (v) => hex6.test(v), message: "primaryHex must be #RRGGBB" } },
    secondaryHex: { type: String, required: true, trim: true, validate: { validator: (v) => hex6.test(v), message: "secondaryHex must be #RRGGBB" } },
  },
  { timestamps: true }
);

const BankCardTheme = mongoose.models.BankCardTheme || mongoose.model("BankCardTheme", BankCardThemeSchema);

export default BankCardTheme;
