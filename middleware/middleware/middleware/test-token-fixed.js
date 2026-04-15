import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('middleware/middleware/middleware/.env') });
console.log("Loaded SECRET_TOKEN:", process.env.HEC_SECRET_TOKEN);
