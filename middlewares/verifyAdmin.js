// verifyAdmin.js
module.exports = (userCollection) => {
  return async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ message: "Unauthorized access - no email found." });
      }

      const user = await userCollection.findOne({ email });
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - Admins only." });
      }

      // All good
      next();
    } catch (err) {
      console.error("Admin check error:", err);
      res.status(500).json({ message: "Server error while verifying admin" });
    }
  };
};
