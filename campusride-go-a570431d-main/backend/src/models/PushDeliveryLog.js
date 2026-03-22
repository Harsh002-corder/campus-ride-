import mongoose from "mongoose";

const pushDeliveryLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", default: null },
    type: { type: String, default: "generic" },
    rideId: { type: String, default: null },
    tokenCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    invalidTokenCount: { type: Number, default: 0 },
    status: { type: String, enum: ["success", "partial", "failed"], default: "failed" },
    errorMessage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "push_delivery_logs",
    versionKey: false,
  },
);

pushDeliveryLogSchema.index({ createdAt: -1 });
pushDeliveryLogSchema.index({ type: 1, createdAt: -1 });
pushDeliveryLogSchema.index({ status: 1, createdAt: -1 });

export const PushDeliveryLog = mongoose.models.PushDeliveryLog || mongoose.model("PushDeliveryLog", pushDeliveryLogSchema);
