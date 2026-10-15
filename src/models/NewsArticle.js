const mongoose = require("mongoose");

const newsArticleSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      index: true,
    },
    title: { 
      type: String, 
      required: true 
    },
    description: { 
      type: String 
    },
    url: { 
      type: String, 
      required: true 
    },
    imageUrl: { 
      type: String 
    },
    source: {
      id: { type: String },
      name: { type: String },
    },
    author: { type: String },
    publishedAt: { type: Date },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

newsArticleSchema.index({ category: 1, url: 1 }, { unique: true });
newsArticleSchema.index({ category: 1, publishedAt: -1 });

module.exports = mongoose.model("NewsArticle", newsArticleSchema);
