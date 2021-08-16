const mongoose = require("mongoose");

const hook = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    damaged: Boolean,
    hookedSurvivor: mongoose.Schema.Types.ObjectId,
    setup: {
        type: Boolean,
        default: false
    },
    uid: String,
    position: {
        type: ['Point']
    }
});

module.exports = mongoose.model("Hook", hook);