import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // Accept either custom 'token' header (legacy) or standard 'authorization'
  const authHeader = req.headers.token || req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No authenticated" });
  }

  // support both "Bearer <token>" and raw token value
  const token =
    typeof authHeader === "string" &&
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

  jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

export const verifyTokenAuthorization = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.id === req.params.id || req.user.isAdmin) {
      next();
    } else {
      console.log(req.user.id, req.params.id);
      return res.status(403).json({ message: "Unauthorized to do that" });
    }
  });
};

export const verifyTokenAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.isAdmin) {
      next();
    } else {
      return res.status(403).json({ message: "Unauthorized to do that" });
    }
  });
};
