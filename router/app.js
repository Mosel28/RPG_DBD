const router = require("express").Router();
const api = require("./api");

router.use("/api/dbm", api);

module.exports = router;