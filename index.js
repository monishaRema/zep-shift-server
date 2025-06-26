const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@remadb.w7lg8gq.mongodb.net/?retryWrites=true&w=majority`;
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("parcelDB"); // database name
    const parcelCollection = db.collection("parcels"); // collection
    const paymentsCollection = db.collection("payments");

    app.get("/parcels", async (req, res) => {
      const parcels = await parcelCollection.find().toArray();
      res.send(parcels);
    });

    // parcels api
    // GET: All parcels OR parcels by user (created_by), sorted by latest
    app.get("/parcels", async (req, res) => {
      try {
        const userEmail = req.query.email;

        const query = userEmail ? { created_by: userEmail } : {};
        const options = {
          sort: { createdAt: -1 }, // Newest first
        };

        const parcels = await parcelCollection.find(query, options).toArray();
        res.send(parcels);
      } catch (error) {
        console.error("Error fetching parcels:", error);
        res.status(500).send({ message: "Failed to get parcels" });
      }
    });

    // GET: Single parcel depending on ID

    app.get("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await parcelCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error deleting parcel:", error);
        res.status(500).send({ message: "Failed to find the parcel" });
      }
    });

    // POST: Create a new parcel
    app.post("/parcels", async (req, res) => {
      try {
        const newParcel = req.body;
        // newParcel.createdAt = new Date();
        const result = await parcelCollection.insertOne(newParcel);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error inserting parcel:", error);
        res.status(500).send({ message: "Failed to create parcel" });
      }
    });

    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await parcelCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error("Error deleting parcel:", error);
        res.status(500).send({ message: "Failed to delete parcel" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // POST: Crete payment API
    app.post("/payments", async (req, res) => {
      try {
        const paymentData = req.body;
        paymentData.createdAt = new Date();
        const result = await paymentsCollection.insertOne(paymentData);

        // Update parcel as paid
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
    // GET: all payment history API for admin
    app.get("/payments", async (req, res) => {
      try {
        const payments = await paymentsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ message: "Failed to get payment history" });
      }
    });
    // GET paymnet history for User depending on Email API.
    app.get("/payments", async (req, res) => {
      try {
        const userEmail = req.query.email;
        const query = userEmail ? { email: userEmail } : {};
        const payments = await paymentsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ message: "Failed to get payment history" });
      }
    });

    // GET: Payment history for a specific parcel
    app.get("/payments/parcel/:parcelId", async (req, res) => {
      try {
        const { parcelId } = req.params;
        const payments = await paymentsCollection
          .find({ parcelId })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments for parcel:", error);
        res
          .status(500)
          .send({ message: "Failed to get payment history for this parcel" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run();

app.listen(port, () => {
  console.log(`🚀 zep shift Server running on port ${port}`);
});
