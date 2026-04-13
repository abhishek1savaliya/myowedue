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

const Person = mongoose.models.Person || mongoose.model("Person", PersonSchema);
export default Person;
