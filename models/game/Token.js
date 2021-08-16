const mongoose = require("mongoose");

const token = new mongoose.Schema({
    session: mongoose.Schema.Types.ObjectId,
    token: String
});

module.exports = mongoose.model("GameToken", token);