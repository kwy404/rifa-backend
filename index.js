import express from 'express';
import axios from 'axios';
import { Sequelize, DataTypes } from 'sequelize';
import chalk from 'chalk'; // Import chalk for colorful console logs
import { config } from 'dotenv'; // Import config function from dotenv

config(); // Load environment variables from .env

const app = express();
const port = process.env.PORT || 3000; // Use the environment port or default to 3000

const accessToken = process.env.MP_ACCESS_TOKEN; // Use the environment access token

// Sequelize initialization
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // Use the environment DB_PORT
  dialect: 'mysql'
});

// Check database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log(chalk.green('[ SERVER ] =>'), 'Database connection established.');
    await sequelize.sync();
  } catch (error) {
    console.error(chalk.red('[ SERVER ] =>'), 'Unable to connect to the database:', error);
  }
})();

// Define RaffleNumber model
const RaffleNumber = sequelize.define('RaffleNumber', {
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
  }
});

app.use(express.json());

class PaymentManager {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  async createPixPayment(amount, description, payerEmail, payerPhone, res) {
    const paymentData = {
      transaction_amount: amount,
      description: description,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail
      },
      notification_url: `${process.env.NOTIFICATION_URL}/notification` // Notification URL
    };

    try {
      const response = await axios.post('https://api.mercadopago.com/v1/payments', paymentData, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const payment = response.data;

      // Store payment details in the database
      const createdPayment = await RaffleNumber.create({
        email: payerEmail,
        phone: payerPhone,
        amount: amount,
        description: description,
        status: payment.status
      });

      console.log(chalk.magenta('[ SERVER ] =>'), 'Payment stored in the database:', createdPayment.toJSON());
      const paymentUrl = payment.transaction_details.external_resource_url;
      return res.json({ message: 'Payment created', paymentUrl });
    } catch (error) {
      console.error(chalk.red('[ SERVER ] =>'), 'Error creating Pix payment:', error);
      return res.status(500).json({ message: 'Error creating payment' });
    }
  }

  async handleNotification(notificationData, res) {
    console.log(chalk.magenta('[ SERVER ] =>    '), 'Received notification from MercadoPago:', notificationData);
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
        status: status
      }, {
        where: { email: payment.payer.email }
      });

      console.log(chalk.magenta('[ SERVER ] =>'), 'Payment status updated in the database:', status);
      return res.json({ message: 'Payment status updated' });
    } catch (error) {
      console.error(chalk.red('[ SERVER ] =>'), 'Error fetching payment details:', error);
      return res.status(500).json({ message: 'Error processing notification' });
    }
  }
}

const paymentManager = new PaymentManager(accessToken);

app.post('/purchaseRaffleNumbers', async (req, res) => {
  const { amount } = req.body;
  const purchasedNumbers = await purchaseRandomNumbers(amount);
  console.log(chalk.magenta('[ SERVER ] =>'), 'Purchased raffle numbers:', purchasedNumbers);
  return res.json({ message: 'Raffle numbers purchased', numbers: purchasedNumbers });
});

app.post('/createPixPayment', (req, res) => {
  const { amount, description, payerEmail, payerPhone } = req.body;
  paymentManager.createPixPayment(amount, description, payerEmail, payerPhone, res);
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

app.listen(port, () => {
  console.log(chalk.magenta('[ SERVER ] =>'), `Server is running on port ${port}`);
});

// Helper function to generate random raffle numbers
async function purchaseRandomNumbers(amount) {
  const purchasedNumbers = [];
  for (let i = 0; i < amount; i++) {
    const randomNum = Math.floor(Math.random() * 100) + 1;
    const existingNumber = await RaffleNumber.findOne({ where: { number: randomNum } });
    if (!existingNumber) {
      await RaffleNumber.create({ number: randomNum });
      purchasedNumbers.push(randomNum);
    } else {
      i--; // Try again for a unique number
    }
  }
  return purchasedNumbers;
}
