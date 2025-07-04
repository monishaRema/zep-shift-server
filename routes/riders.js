const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyFBToken } = require("../middlewares/verifyFBToken");

module.exports = ({ ridersCollection, userCollection }) => {
  const router = express.Router();

  // POST: create new rider
  router.post("/", verifyFBToken, async (req, res) => {
    try {
      const {
        name,
        age,
        email,
        region,
        district,
        nid,
        contact,
        bike_registration,
        warehouse,
      } = req.body;

      if (
        !name ||
        !age ||
        !email ||
        !region ||
        !district ||
        !nid ||
        !contact ||
        !bike_registration ||
        !warehouse
      ) {
        return res.status(400).json({ message: "All fields are required." });
      }

      if (req.user.email !== email) {
        return res.status(401).json({ message: "Email mismatch." });
      }

      const newRider = {
        name,
        age: Number(age),
        email,
        region,
        district,
        nid,
        contact,
        bike_registration,
        warehouse,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const result = await ridersCollection.insertOne(newRider);
      res.status(201).json({ insertedId: result.insertedId });
    } catch (err) {
      console.error("Rider POST error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // GET: all riders
  router.get("/", async (req, res) => {
    const riders = await ridersCollection.find().toArray();
    res.json(riders);
  });

  // GET: pending riders
  router.get("/pending-riders", async (req, res) => {
    const riders = await ridersCollection.find({ status: "pending" }).toArray();
    res.json(riders);
  });

  // GET: active riders
  router.get("/active-riders", verifyFBToken, async (req, res) => {
    const riders = await ridersCollection.find({ status: "active" }).toArray();
    res.json(riders);
  });
  // GET: deactive riders
  router.get("/deactivated-riders", verifyFBToken, async (req, res) => {
    const riders = await ridersCollection
      .find({ status: "deactivated" })
      .toArray();
    res.json(riders);
  });
  // GET: Rejected riders
  router.get("/rejected-riders", verifyFBToken, async (req, res) => {
    const riders = await ridersCollection
      .find({ status: "rejected" })
      .toArray();
    res.json(riders);
  });

  // PATCH: update rider status
  router.patch("/:id", verifyFBToken, async (req, res) => {
    const { id } = req.params;
    const { status, email } = req.body;

    const result = await ridersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (status === "active" && result.modifiedCount) {
      await userCollection.updateOne({ email }, { $set: { role: "rider" } });
    }

    res.json({
      message: "Status updated",
      modifiedCount: result.modifiedCount,
    });
  });

  // GET: Available riders based on region
  router.get("/available", async (req, res) => {
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({ message: "Region is required" });
    }

    try {
      const riders = await ridersCollection
        .find({ status: "active", region })
        .toArray();

      res.json(riders);
    } catch (err) {
      console.error("Fetch available riders by region failed:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
