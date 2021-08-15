const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        require: true,
        min: 4
    },
    password: {
        type: String,
        require: true,
        max: 1024,
        min: 6
    }
});

module.exports = mongoose.model("User", userSchema);