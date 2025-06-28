const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { initializeApp } = require("firebase-admin/app");
const admin = require("firebase-admin");

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

const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("parcelDB");
    const parcelCollection = db.collection("parcels"); //all parcels data Collection
    const paymentsCollection = db.collection("payments"); //all payments data Collection
    const trackingCollection = db.collection("tracking"); // all package tracking data Collection
    const userCollection = db.collection("users"); // all users data Collection
    const ridersCollection = db.collection("riders"); // all riders data Collection

    app.get("/parcels", async (req, res) => {
      const parcels = await parcelCollection.find().toArray();
      res.send(parcels);
    });

    // Firebase accesToken verification
    const verifyFBToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res
          .status(401)
          .send({ message: "Unauthorized: No auth header" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized: No token" });
      }

      try {
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.user = decodedUser; // Attach to request for downstream use
        next();
      } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).send({ message: "Forbidden: Invalid token" });
      }
    };

    // POST: create new rider and check existing rider
    app.post("/rider", verifyFBToken, async (req, res) => {
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

        // Validate required fields
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

        // Ensure the email in token matches the email sent in body (for security)
        if (req.user.email !== email) {
          return res
            .status(401)
            .json({ message: "Token email does not match request email." });
        }

        // Prevent duplicate registration (by email or NID)
        const existingRider = await ridersCollection.findOne({
          $or: [{ email }, { nid }],
        });

        if (existingRider) {
          return res
            .status(409)
            .json({ message: "Rider already exists with this email or NID." });
        }

        // Prepare rider object (always set status/pending and created_at here)
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

        if (result.insertedId) {
          res.status(201).json({ insertedId: result.insertedId });
        } else {
          throw new Error("Insert failed");
        }
      } catch (err) {
        console.error("Rider POST error:", err);
        res.status(500).json({ message: "Server error. Please try again." });
      }
    });
    // POST: create user api and check existing user
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const newUser = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      try {
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          //Update user last loggedIn
          const result = await userCollection.updateOne(
            { email },
            { $set: { last_loggedIn: newUser.last_loggedIn } },
            { upsert: true }
          );

          return res.status(200).send({
            message: "User already exists",
            insertedId: false,
            user: existingUser,
          });
        }

        const result = await userCollection.insertOne(newUser);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error", insertedId: false });
      }
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

    // DELETE: delete parcels api
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

    // POST tracking API
    app.post("/tracking", async (req, res) => {
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

    // GET tracking API

    app.get("/tracking", async (req, res) => {
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

    // POST : Payment intent api
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

    // POST: Create payment API
    app.post("/payments", verifyFBToken, async (req, res) => {
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
    app.get("/payments", verifyFBToken, async (req, res) => {
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
    app.get("/payments", verifyFBToken, async (req, res) => {
      try {
        const userEmail = req.query.email;
        // Check User email with varified email
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
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
