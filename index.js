import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { sequelize } from './db/db.js';
import RaffleController from './controllers/RaffleController.js';
import PaymentManager from './managers/PaymentManager.js';

config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 9000;
const accessToken = process.env.MP_ACCESS_TOKEN;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[SERVER] => Database connection established.');
    await sequelize.sync();
  } catch (error) {
    console.error('[SERVER] => Unable to connect to the database:', error);
  }
})();

const raffleController = new RaffleController();
const paymentManager = new PaymentManager(accessToken);

app.get('/raffles', (req, res) => raffleController.listRaffles(req, res));
app.get('/raffles/:id', (req, res) => raffleController.getRaffleById(req, res));
app.delete('/deleteRaffle/:id', (req, res) => raffleController.deleteRaffle(req, res));
app.post('/createRaffle', (req, res) => raffleController.createRaffle(req, res));
app.post('/createPixPayment', (req, res) => paymentManager.createPixPayment(req, res));
app.post('/notification', (req, res) => paymentManager.handleNotification(req, res));
app.get('/raffleNumbers/:email', (req, res) => raffleController.listRaffleNumbers(req, res));

app.listen(port, () => {
  console.log(`[SERVER] => Server is running on port ${port}`);
});
