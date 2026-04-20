import mongoose, { Schema } from "mongoose";

const CMSPageSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["home", "contact-us", "privacy-policy"],
      index: true,
    },
    content: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const CMSPage = mongoose.models.CMSPage || mongoose.model("CMSPage", CMSPageSchema);

export default CMSPage;
