const mongoose = require("mongoose");

const gen = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    progress: Number,
    damaged: Boolean,
    finished: Boolean,
    setup: {
        type: Boolean,
        default: false
    },
    uid: String,
    position: {
        type: ['Point']
    }
});

module.exports = mongoose.model("Generator", gen);