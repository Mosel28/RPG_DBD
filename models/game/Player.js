const mongoose = require("mongoose");

const player = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    position: {
        type: ['Point']
    },
    isKiller: {
        type: Boolean,
        default: false
    },
    isSurvivor: {
        type: Boolean,
        default: false
    },
    hookState: {
        type: Number,
        default: 0
    },
    user: mongoose.Schema.Types.ObjectId
});

module.exports = mongoose.model("Player", player);