const mongoose = require("mongoose");

const session = new mongoose.Schema({
    entity: String,
    state: Number,
    //0 = running, 1 = queue

    maxPlayers: {
        type: Number,
        default: 5
    },
    maxKillers: {
        type: Number,
        default: 1
    },
    setupDone: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model("GameSession", session);