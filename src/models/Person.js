import mongoose, { Schema } from "mongoose";

const PersonSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    restoreUntil: { type: Date },
  },
  { timestamps: true }
);

PersonSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
PersonSchema.index({ userId: 1, isDeleted: 1, name: 1 });

const Person = mongoose.models.Person || mongoose.model("Person", PersonSchema);
export default Person;
