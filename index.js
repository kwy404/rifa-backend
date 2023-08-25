import express from 'express';
import axios from 'axios';
import { Sequelize, DataTypes } from 'sequelize';
import chalk from 'chalk';
import { config } from 'dotenv';
import cors from 'cors';

config();

const app = express();
app.use(cors()); // Habilitar o uso do CORS
const port = process.env.PORT || 3000;

const accessToken = process.env.MP_ACCESS_TOKEN;

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'mysql'
});

const predefinedAccessToken = process.env.PASS_ADMIN;

class Raffle extends Sequelize.Model {}
Raffle.init({
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  minTickets: { // Add minimum tickets field
    type: DataTypes.INTEGER,
    allowNull: false
  },
  maxTickets: { // Add maximum tickets field
    type: DataTypes.INTEGER,
    allowNull: false
  },
  totalTickets: { // Add total tickets field
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, { sequelize, modelName: 'raffle' });

class RaffleNumber extends Sequelize.Model {}
RaffleNumber.init({
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  raffleId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, { sequelize, modelName: 'raffleNumber' });

(async () => {
  try {
    await sequelize.authenticate();
    console.log(chalk.green('[ SERVER ] =>'), 'Database connection established.');
    await sequelize.sync();
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Unable to connect to the database:', error);
  }
})();

app.use(express.json());

class PaymentManager {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  async createPixPayment(amount, raffleId, payerEmail, payerPhone, res) {
    const raffle = await Raffle.findOne({ where: { id: raffleId } });
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }
    
    if (amount < raffle.minTickets || amount > raffle.maxTickets) { // Check if the number of tickets is within the allowed range
      return res.status(400).json({ message: 'Invalid number of tickets' });
    }

    const totalAmount = raffle.price * amount; // Calculate total amount
    const paymentData = {
      transaction_amount: totalAmount,
      description: `Rifa - ${raffleId}`,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail
      },
      notification_url: `${process.env.NOTIFICATION_URL}/notification`
    };

    try {
      const response = await axios.post('https://api.mercadopago.com/v1/payments', paymentData, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const payment = response.data;

      const purchasedNumbers = await purchaseRaffleNumbers(raffleId, amount); // Generate raffle numbers based on the total number of tickets
      const createdNumbers = await createRaffleNumbers(raffleId, purchasedNumbers, payerEmail, payerPhone, payment.id);

      console.log(chalk.magenta('[ SERVER ] =>'), 'Payment stored in the database:', createdNumbers);
      const mercadoPago = payment;
      return res.json({ message: 'Payment created', payment: mercadoPago.point_of_interaction.transaction_data, purchasedNumbers, totalAmount });
    } catch (error) {
      console.error(chalk.red('[ SERVER ] =>'), 'Error creating Pix payment:', error);
      return res.status(500).json({ message: 'Error creating payment' });
    }
  }

  async handleNotification(notificationData, res) {
    console.log(chalk.magenta('[ SERVER ] =>'), 'Received notification from MercadoPago:', notificationData);
    try {
      const paymentId = notificationData.data.id;
      try {
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        const payment = response.data;
        const status = payment.status;

        await RaffleNumber.update({
          status: status,
        }, {
          where: { transactionId: payment.id }
        });

        console.log(chalk.magenta('[ SERVER ] =>'), 'Payment status updated in the database:', status);
        return res.json({ message: 'Payment status updated' });
      } catch (error) {
        console.error(chalk.red('[ SERVER ] =>'), 'Error fetching payment details:', error);
        return res.status(500).json({ message: 'Error processing notification' });
      }
    } catch (error) {
      try {
        const paymentId = notificationData.resource.split("notifications/")[1];
        try {
          const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          });

          const payment = response.data;
          const status = payment.status;

          await RaffleNumber.update({
            status: status,
          }, {
            where: { transactionId: payment.id }
          });

          console.log(chalk.magenta('[ SERVER ] =>'), 'Payment status updated in the database:', status);
          return res.json({ message: 'Payment status updated' });
        } catch (error) {
          console.error(chalk.red('[ SERVER ] =>'), 'Error fetching payment details:', error);
          return res.status(500).json({ message: 'Error processing notification' });
        }
      } catch (error) {
        
      }
    }
  }
}

// Rota para listar todas as rifas disponíveis
app.get('/raffles', async (req, res) => {
  try {
    const raffles = await Raffle.findAll();
    return res.json(raffles);
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Error fetching raffles:', error);
    return res.status(500).json({ message: 'Error fetching raffles' });
  }
});

// Rota para deletar uma rifa pelo ID e token de admin
app.delete('/deleteRaffle/:id', async (req, res) => {
  const raffleId = req.params.id;
  const token = req.query.token;
  
  if (token !== predefinedAccessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const raffle = await Raffle.findByPk(raffleId);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }

    await raffle.destroy();
    
    // Retorna todas as rifas restantes após a exclusão
    const remainingRaffles = await Raffle.findAll();
    return res.json({ message: 'Raffle deleted', remainingRaffles: remainingRaffles });
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Error deleting raffle:', error);
    return res.status(500).json({ message: 'Error deleting raffle' });
  }
});

// Rota para listar uma rifa pelo ID
app.get('/raffles/:id', async (req, res) => {
  const raffleId = req.params.id;
  try {
    const raffle = await Raffle.findByPk(raffleId);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }
    return res.json(raffle);
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Error fetching raffle by ID:', error);
    return res.status(500).json({ message: 'Error fetching raffle by ID' });
  }
});

const paymentManager = new PaymentManager(accessToken);

app.post('/createRaffle', async (req, res) => {
  const { title, description, image, price, minTickets, maxTickets, totalTickets, token } = req.body;
  if (token !== predefinedAccessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const raffle = await Raffle.create({
      title: title,
      description: description,
      image: image,
      price: price,
      minTickets: minTickets,
      maxTickets: maxTickets,
      totalTickets: totalTickets
    });
    return res.json({ message: 'Raffle created', raffle: raffle });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating raffle' });
  }
});

app.post('/createPixPayment', (req, res) => {
  const { amount, raffleId, payerEmail, payerPhone } = req.body;
  paymentManager.createPixPayment(amount, raffleId, payerEmail, payerPhone, res);
});

app.post('/notification', (req, res) => {
  const notificationData = req.body;
  paymentManager.handleNotification(notificationData, res);
});

app.get('/raffleNumbers/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const raffleNumbers = await RaffleNumber.findAll({
      attributes: ['number', 'status'],
      where: { email: email }
    });
    return res.json(raffleNumbers);
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Error fetching raffle numbers:', error);
    return res.status(500).json({ message: 'Error fetching raffle numbers' });
  }
});

async function purchaseRaffleNumbers(raffleId, amount) {
  const purchasedNumbers = [];
  const raffle = await Raffle.findByPk(raffleId);
  if (!raffle) {
    throw new Error('Raffle not found');
  }

  const maxNumber = raffle.totalTickets;
  for (let i = 0; i < amount; i++) {
    const randomNum = Math.floor(Math.random() * (maxNumber + 1)); // Generate numbers from 0 to maxNumber
    purchasedNumbers.push(randomNum);
  }
  
  return purchasedNumbers;
}

async function createRaffleNumbers(raffleId, purchasedNumbers, payerEmail, payerPhone, paymentId) {
  const createdNumbers = [];
  for (const number of purchasedNumbers) {
    const createdPayment = await RaffleNumber.create({
      number: number,
      email: payerEmail,
      phone: payerPhone,
      status: 'pending',
      raffleId: raffleId,
      transactionId: paymentId
    });

    setTimeout(async () => {
      await removeUnpaidNumbers(createdPayment.id);
    }, 2 * 60 * 60 * 1000);

    createdNumbers.push(createdPayment.toJSON());
  }
  return createdNumbers;
}

async function removeUnpaidNumbers(paymentId) {
  try {
    await RaffleNumber.destroy({ where: { transactionId: paymentId, status: 'pending' } });
    console.log(chalk.magenta('[ SERVER ] =>'), 'Unpaid numbers removed from the database');
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Error removing unpaid numbers:', error);
  }
}

app.listen(port, () => {
  console.log(chalk.magenta('[ SERVER ] =>'), `Server is running on port ${port}`);
});