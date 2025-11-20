import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import projectRoutes from './routes/project.routes';
import businessPlanRoutes from './routes/businessPlan.routes';
import propertyRoutes from './routes/property.routes';
import dvfRoutes from './routes/dvf.routes';
import pdfRoutes from './routes/pdf.routes';
import photoRoutes from './routes/photo.routes';
import prisma from './config/database';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

// Configuration de CORS
const corsOptions = {
  origin: true, // Permettre toutes les origines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Configuration de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/data/lki/uploads';
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers images sont acceptés'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  }
});

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Gestion explicite des requêtes OPTIONS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/business-plan', businessPlanRoutes);
app.use('/api/property', propertyRoutes);
app.use('/api/dvf', dvfRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/photos', photoRoutes);

// Middleware pour servir les fichiers statiques
app.use('/uploads', express.static('/data/lki/uploads', {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Error handling
app.use(errorHandler);

// Fermeture propre de la connexion à la base de données
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
}); 

export default app; 