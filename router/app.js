const router = require("express").Router();
const api = require("./api");

router.use("/api/ws", api);

module.exports = router;