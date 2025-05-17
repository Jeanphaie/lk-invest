"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const businessPlan_routes_1 = __importDefault(require("./routes/businessPlan.routes"));
const property_routes_1 = __importDefault(require("./routes/property.routes"));
const dvf_routes_1 = __importDefault(require("./routes/dvf.routes"));
const pdf_routes_1 = __importDefault(require("./routes/pdf.routes"));
const photo_routes_1 = __importDefault(require("./routes/photo.routes"));
const database_1 = __importDefault(require("./config/database"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3001;
// Configuration de CORS
const corsOptions = {
    origin: true, // Permettre toutes les origines
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
// Configuration de Multer
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const dir = '/data/lki/uploads';
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Seuls les fichiers images sont acceptés'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});
// Middleware
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions)); // Gestion explicite des requêtes OPTIONS
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Routes
app.use('/api/projects', project_routes_1.default);
app.use('/api/business-plan', businessPlan_routes_1.default);
app.use('/api/property', property_routes_1.default);
app.use('/api/dvf', dvf_routes_1.default);
app.use('/api/pdf', pdf_routes_1.default);
app.use('/api/photos', photo_routes_1.default);
// Middleware pour servir les fichiers statiques
app.use('/uploads', express_1.default.static('/data/lki/uploads', {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));
// Gestion des erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Une erreur est survenue sur le serveur' });
});
// Fermeture propre de la connexion à la base de données
process.on('SIGINT', async () => {
    await database_1.default.$disconnect();
    process.exit(0);
});
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
