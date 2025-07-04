const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = ({ trackingCollection }) => {
  const router = express.Router();

  // Log a new tracking entry
  router.post("/", async (req, res) => {
    const {
      tracking_id,
      parcel_id,
      status,
      message,
      updated_by = "",
    } = req.body;

    const log = {
      tracking_id,
      parcel_id: parcel_id ? new ObjectId(parcel_id) : undefined,
      status,
      message,
      time: new Date(),
      updated_by,
    };

    const result = await trackingCollection.insertOne(log);
    res.send({ success: true, insertedId: result.insertedId });
  });

  // Get tracking logs
  router.get("/", async (req, res) => {
    const { tracking_id, parcel_id } = req.query;
    let query = {};
    if (tracking_id) query.tracking_id = tracking_id;
    if (parcel_id) query.parcel_id = new ObjectId(parcel_id);

    const logs = await trackingCollection
      .find(query)
      .sort({ time: 1 })
      .toArray();
    res.send(logs);
  });

  return router;
};
