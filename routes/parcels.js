const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyFBToken } = require("../middlewares/verifyFBToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

module.exports = ({ parcelCollection, ridersCollection, userCollection }) => {
  const router = express.Router();
  const checkAdmin = verifyAdmin(userCollection);

  // GET: Paginated parcels
  router.get("/all-parcels", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
      const total = await parcelCollection.countDocuments();
      const parcels = await parcelCollection
        .find({})
        .sort({ creation_date: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      res.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        parcels,
      });
    } catch (error) {
      console.error("Parcel fetch error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // GET: All parcels or by user email
  // GET: All parcels or filtered by query params
  router.get("/", async (req, res) => {
    const { email, payment_status, delivery_status } = req.query;

    const query = {};

    // Filter by user email
    if (email) {
      query.created_by = email;
    }

    // Filter by payment status
    if (payment_status) {
      query.payment_status = payment_status;
    }

    // Filter by delivery status
    if (delivery_status) {
      query.delivery_status = delivery_status;
    }

    try {
      const parcels = await parcelCollection
        .find(query)
        .sort({ creation_date: -1 }) // sort by latest
        .toArray();

      res.send(parcels);
    } catch (err) {
      console.error("Failed to fetch parcels:", err);
      res.status(500).json({ message: "Server error" });
    }
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

  router.patch("/assign/:id", verifyFBToken, checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { riderId, riderName, riderEmail, riderContact } = req.body;

    const parcelUpdate = await parcelCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          delivery_status: "rider-assigned",
          rider: {
            riderId,
            riderName,
            riderEmail,
            riderContact,
          },
        },
      }
    );

    const riderUpdate = await ridersCollection.updateOne(
      { _id: new ObjectId(riderId) },
      {
        $set: {
          delivery_status: "in_delivery",
          assigned_parcel: id,
        },
      },
      { upsert: true }
    );

    res.json({
      message: "Parcel assigned successfully",
      parcelModified: parcelUpdate.modifiedCount,
      riderModified: riderUpdate.modifiedCount,
    });
  });

  return router;
};
