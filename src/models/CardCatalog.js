import mongoose, { Schema } from "mongoose";

const CardTypeSchema = new Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CountrySchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const VariantSchema = new Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    network: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const BankSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true },
    cardTypes: { type: [String], default: [] },
    variants: { type: [VariantSchema], default: [] },
  },
  { _id: false }
);

const CardCatalogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, default: "default" },
    cardTypes: { type: [CardTypeSchema], default: [] },
    countries: { type: [CountrySchema], default: [] },
    banks: { type: [BankSchema], default: [] },
    updatedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedByAdminName: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const CardCatalog = mongoose.models.CardCatalog || mongoose.model("CardCatalog", CardCatalogSchema);

export default CardCatalog;
