import mongoose, { Schema } from "mongoose";

const AdminUserSchema = new Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["superadmin", "support", "manager"],
      default: "support",
    },
    employeeId: { type: String, unique: true, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null, index: true },
    passwordPreviewEnc: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

let AdminUser;

if (mongoose.models.AdminUser) {
  AdminUser = mongoose.models.AdminUser;

  const missingPaths = {};
  if (!AdminUser.schema.path("firstName")) {
    missingPaths.firstName = { type: String, trim: true, default: "" };
  }
  if (!AdminUser.schema.path("lastName")) {
    missingPaths.lastName = { type: String, trim: true, default: "" };
  }
  if (!AdminUser.schema.path("managerId")) {
    missingPaths.managerId = { type: Schema.Types.ObjectId, ref: "AdminUser", default: null, index: true };
  }
  if (!AdminUser.schema.path("passwordPreviewEnc")) {
    missingPaths.passwordPreviewEnc = { type: String, default: "" };
  }

  if (Object.keys(missingPaths).length > 0) {
    AdminUser.schema.add(missingPaths);
  }
} else {
  AdminUser = mongoose.model("AdminUser", AdminUserSchema);
}

export default AdminUser;
