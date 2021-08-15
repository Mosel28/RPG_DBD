const mongoose = require("mongoose");

const hook = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    damaged: Boolean,
    hookedSurvivor: mongoose.Schema.Types.ObjectId,
    position: {
        type: ['Point']
    }
});

module.exports = mongoose.model("Hook", hook);