const { initializeApp } = require("firebase-admin/app");
const admin = require("firebase-admin");

const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Firebase accesToken verification
const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized: No auth header" });
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

module.exports = { verifyFBToken };