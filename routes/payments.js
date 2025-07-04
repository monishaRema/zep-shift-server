const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyFBToken } = require("../middlewares/verifyFBToken");

module.exports = ({ paymentsCollection, parcelCollection }, stripe) => {
  const router = express.Router();

  // Create Stripe payment intent
  router.post("/create-payment-intent", async (req, res) => {
    const { amountInCents } = req.body;
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save payment
  router.post("/", verifyFBToken, async (req, res) => {
    try {
      const paymentData = req.body;
      paymentData.createdAt = new Date();

      const result = await paymentsCollection.insertOne(paymentData);

      if (paymentData.parcelId) {
        await parcelCollection.updateOne(
          { _id: new ObjectId(paymentData.parcelId) },
          {
            $set: {
              payment_status: "paid",
              transactionId: paymentData.transactionId,
            },
          }
        );
      }

      res.status(201).send(result);
    } catch (error) {
      console.error("Error saving payment:", error);
      res.status(500).send({ message: "Failed to save payment" });
    }
  });

  // Admin: Get all payments
  router.get("/", verifyFBToken, async (req, res) => {
    try {
      const userEmail = req.query.email;
      if (userEmail) {
        // for user payments
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "Forbidden" });
        }
        const payments = await paymentsCollection
          .find({ email: userEmail })
          .sort({ createdAt: -1 })
          .toArray();
        return res.send(payments);
      }

      // admin payments
      const all = await paymentsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(all);
    } catch (error) {
      res.status(500).send({ message: "Failed to get payments" });
    }
  });

  // Get payment history for a parcel
  router.get("/parcel/:parcelId", async (req, res) => {
    try {
      const { parcelId } = req.params;
      const result = await paymentsCollection
        .find({ parcelId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to get parcel payments" });
    }
  });

  return router;
};
