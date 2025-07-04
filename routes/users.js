const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyFBToken } = require("../middlewares/verifyFBToken");

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

  // GET : user depending on search
router.get("/search",verifyFBToken, async (req, res) => {
  const emailQuery = req.query.email;

  if (!emailQuery) return res.status(400).json({ message: "Email query required" });
  const safeQuery = emailQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const users = await userCollection
      .find({ email: { $regex: safeQuery, $options: "i" } })
      .limit(10)
      .toArray();

    res.json(users);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/role", verifyFBToken, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );

    res.json({
      message: `User role updated to ${role}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



  return router;
};
