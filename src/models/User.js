import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true, default: "" },
    reminderFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
    },
    notificationsEnabled: { type: Boolean, default: true },
    cmsRole: {
      type: String,
      enum: ["super_admin", "manager", "team_member"],
      default: "manager",
      index: true,
    },
    contentEditPermission: { type: Boolean, default: false },
    contentManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    notificationGeneration: {
      day: { type: String, default: "" },
      count: { type: Number, default: 0 },
      types: { type: [String], default: [] },
    },
    darkMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

let User;

if (mongoose.models.User) {
  User = mongoose.models.User;

  const missingPaths = {};
  if (!User.schema.path("firstName")) missingPaths.firstName = { type: String, trim: true };
  if (!User.schema.path("lastName")) missingPaths.lastName = { type: String, trim: true };
  if (!User.schema.path("phone")) missingPaths.phone = { type: String, trim: true, default: "" };
  if (!User.schema.path("notificationsEnabled")) missingPaths.notificationsEnabled = { type: Boolean, default: true };
  if (!User.schema.path("cmsRole")) {
    missingPaths.cmsRole = {
      type: String,
      enum: ["super_admin", "manager", "team_member"],
      default: "manager",
      index: true,
    };
  }
  if (!User.schema.path("contentEditPermission")) missingPaths.contentEditPermission = { type: Boolean, default: false };
  if (!User.schema.path("contentManagerId")) {
    missingPaths.contentManagerId = { type: Schema.Types.ObjectId, ref: "User", default: null, index: true };
  }
  if (!User.schema.path("notificationGeneration")) {
    missingPaths.notificationGeneration = {
      day: { type: String, default: "" },
      count: { type: Number, default: 0 },
      types: { type: [String], default: [] },
    };
  }

  if (Object.keys(missingPaths).length > 0) {
    User.schema.add(missingPaths);
  }
} else {
  User = mongoose.model("User", UserSchema);
}

export default User;
