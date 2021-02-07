import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
export async function getAuthUser(req, res, next) {
  if (!req.headers.authorization) {
    req.user = null;
    return next();
  }

  try {
    const token = req.headers.authorization;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { videos: true },
    });
    req.user = user;
    next();
  } catch (error) {
    return res.status(400).json({ error: "user not found" });
  }
}
export async function protect(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return next({ message: "You neet to be logged in", statusCode: 401 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { videos: true },
    });
    req.user = user;
    next();
  } catch (error) {
    return res.status(400).json({ error: "user not found" });
  }
}
