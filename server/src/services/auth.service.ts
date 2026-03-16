import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

export type AuthResult = {
  userId: string;
  username: string;
  token: string;
  expiresIn: number;
};

export async function register(
  username: string,
  password: string
): Promise<AuthResult> {
  // Validate inputs
  if (!username || username.trim().length === 0) {
    throw new Error("Username is required");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error("Username already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName: username
    }
  });

  // Generate token
  const token = generateToken(user.id);

  return {
    userId: user.id,
    username: user.username,
    token,
    expiresIn: env.jwtExpiresDays * 24 * 3600
  };
}

export async function login(
  username: string,
  password: string
): Promise<AuthResult> {
  // Validate inputs
  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  // Find user
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new Error("Invalid username or password");
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid username or password");
  }

  // Generate token
  const token = generateToken(user.id);

  return {
    userId: user.id,
    username: user.username,
    token,
    expiresIn: env.jwtExpiresDays * 24 * 3600
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      platformRole: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function updateCurrentUserProfile(userId: string, displayName: string) {
  const normalized = typeof displayName === "string" ? displayName.trim() : "";
  if (!normalized) {
    throw new Error("Display name is required");
  }
  if (normalized.length > 40) {
    throw new Error("Display name is too long");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { displayName: normalized },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      platformRole: true,
      createdAt: true
    }
  });

  return updated;
}

function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: `${env.jwtExpiresDays}d`
  });
}
