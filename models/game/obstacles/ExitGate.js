const mongoose = require("mongoose");

const gate = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    position: {
        type: ['Point']
    },
    setup: {
        type: Boolean,
        default: false
    },
    uid: String,
    openingProgress: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("ExitGate", gate);