const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String },
    imageUrl: { type: String },
    source: { type: String },
    category: { type: String },
    // How the alert reached the user: 'email' and/or 'browser'.
    channels: { type: [String], default: ['email'] },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, sentAt: -1 });
notificationSchema.index({ user: 1, url: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
