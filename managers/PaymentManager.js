import axios from 'axios';
import chalk from 'chalk';
import Raffle from '../models/Raffle.js'; // Import the Raffle class
import RaffleController from '../controllers/RaffleController.js';
import RaffleNumber from '../models/RaffleNumber.js';

class PaymentManager {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.raffleController = new RaffleController(); // Create an instance of RaffleController
  }

  async createPixPayment(req, res) {
    const { amount, raffleId, payerEmail, payerPhone } = req.body;

    try {
      const raffle = await Raffle.findByPk(raffleId);
      if (!raffle) {
        return res.status(404).json({ message: 'Raffle not found' });
      }

      if (amount < raffle.minTickets || amount > raffle.maxTickets) {
        return res.status(400).json({ message: 'Invalid number of tickets' });
      }

      const totalAmount = raffle.price * amount;
      const paymentData = {
        transaction_amount: totalAmount,
        description: `Raffle - ${raffleId}`,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail
        },
        notification_url: `${process.env.NOTIFICATION_URL}/notification`
      };

      const response = await axios.post('https://api.mercadopago.com/v1/payments', paymentData, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const payment = response.data;

      const purchasedNumbers = await this.purchaseRaffleNumbers(raffleId, amount);
      const createdNumbers = await this.createRaffleNumbers(raffleId, purchasedNumbers, payerEmail, payerPhone, payment.id);

      console.log(chalk.magenta('[ SERVER ] =>'), 'Payment stored in the database:', createdNumbers);
      const mercadoPago = payment;
      return res.json({ message: 'Payment created', payment: mercadoPago.point_of_interaction.transaction_data, purchasedNumbers, totalAmount });
    } catch (error) {
      console.error(chalk.red('[ SERVER ] =>'), 'Error creating Pix payment:', error);
      return res.status(500).json({ message: 'Error creating payment' });
    }
  }

  async handleNotification(req, res) {
    const notificationData = req.body;
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
        console.error(chalk.red('[ SERVER ] =>'), 'Error processing notification:', error);
        return res.status(500).json({ message: 'Error processing notification' });
      }
    }
  }

  async purchaseRaffleNumbers(raffleId, amount) {
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

  async createRaffleNumbers(raffleId, purchasedNumbers, payerEmail, payerPhone, paymentId) {
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
        await this.removeUnpaidNumbers(createdPayment.id);
      }, 2 * 60 * 60 * 1000);

      createdNumbers.push(createdPayment.toJSON());
    }
    return createdNumbers;
  }

  async removeUnpaidNumbers(paymentId) {
    try {
      await RaffleNumber.destroy({ where: { transactionId: paymentId, status: 'pending' } });
      console.log(chalk.magenta('[ SERVER ] =>'), 'Unpaid numbers removed from the database');
    } catch (error) {
      console.error(chalk.red('[ SERVER ] =>'), 'Error removing unpaid numbers:', error);
    }
  }
}

export default PaymentManager;