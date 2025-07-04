const express = require("express");

module.exports = ({ userCollection }) => {
  const router = express.Router();

  // Create or update user
  router.post("/", async (req, res) => {
    const email = req.body.email;
    const newUser = req.body;

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    try {
      const existingUser = await userCollection.findOne({ email });

      if (existingUser) {
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
      res.status(500).send({ message: "Server error", insertedId: false });
    }
  });

  return router;
};
