const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = ({ parcelCollection }) => {
  const router = express.Router();

  // GET: All parcels or by user email
  router.get("/", async (req, res) => {
    const userEmail = req.query.email;
    const query = userEmail ? { created_by: userEmail } : {};
    const parcels = await parcelCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(parcels);
  });

  // GET: Single parcel
  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const parcel = await parcelCollection.findOne({ _id: new ObjectId(id) });
    res.send(parcel);
  });

  // POST: Create new parcel
  router.post("/", async (req, res) => {
    const newParcel = req.body;
    const result = await parcelCollection.insertOne(newParcel);
    res.status(201).send(result);
  });

  // DELETE: Delete parcel
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const result = await parcelCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  return router;
};