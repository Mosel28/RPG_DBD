const mongoose = require("mongoose");

const session = new mongoose.Schema({
    entity: String
});

module.exports = mongoose.model("GameSession", session);