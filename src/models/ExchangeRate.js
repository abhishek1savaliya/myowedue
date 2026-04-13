import mongoose, { Schema } from "mongoose";

const ExchangeRateSchema = new Schema(
  {
    base: { type: String, default: "USD", trim: true, uppercase: true },
    rates: { type: Map, of: Number, required: true },
    provider: { type: String, default: "exchangeratesapi", trim: true },
    fetchedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

const ExchangeRate = mongoose.models.ExchangeRate || mongoose.model("ExchangeRate", ExchangeRateSchema);

export default ExchangeRate;
