"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const { PrismaClient } = require("@prisma/client");

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV === "development") globalForPrisma.prisma = prisma;

exports.default = prisma; 