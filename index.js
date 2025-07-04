const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Client Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@remadb.w7lg8gq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// DB + Route Bootstrapping
async function run() {
  try {
    const db = client.db("parcelDB");

    const collections = {
      parcelCollection: db.collection("parcels"),
      paymentsCollection: db.collection("payments"),
      trackingCollection: db.collection("tracking"),
      userCollection: db.collection("users"),
      ridersCollection: db.collection("riders"),
    };

    // Inject dependencies to each route
    app.use("/riders", require("./routes/riders")(collections));
    app.use("/parcels", require("./routes/parcels")(collections));
    app.use("/tracking", require("./routes/tracking")(collections));
    app.use("/payments", require("./routes/payments")(collections, stripe));
    app.use("/users", require("./routes/users")(collections));

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB connection successful");
  } catch (err) {
    console.error("❌ MongoDB connection failed", err);
  }
}

run();

app.listen(port, () => {
  console.log(`🚀 zep shift Server running on port ${port}`);
});
