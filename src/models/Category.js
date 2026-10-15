const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: String,
    slug: {
        type: String,
        unique: true,
        lowercase: true
    }
})

categorySchema.pre("save", function () {
    if (this.name) {
        this.slug = this.name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-");
    }
});

module.exports = mongoose.model("Category", categorySchema);