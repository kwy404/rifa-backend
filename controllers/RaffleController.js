import Raffle from '../models/Raffle.js';
import RaffleNumber from '../models/RaffleNumber.js';

const predefinedAccessToken = process.env.PASS_ADMIN;

class RaffleController {
  async listRaffles(req, res) {
    try {
      const raffles = await Raffle.findAll();
      return res.json(raffles);
    } catch (error) {
      console.error('[SERVER] => Error fetching raffles:', error);
      return res.status(500).json({ message: 'Error fetching raffles' });
    }
  }

  async getRaffleById(req, res) {
    const raffleId = req.params.id;
    try {
      const raffle = await Raffle.findByPk(raffleId);
      if (!raffle) {
        return res.status(404).json({ message: 'Raffle not found' });
      }
      return res.json(raffle);
    } catch (error) {
      console.error('[SERVER] => Error fetching raffle by ID:', error);
      return res.status(500).json({ message: 'Error fetching raffle by ID' });
    }
  }

  async deleteRaffle(req, res) {
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

      const remainingRaffles = await Raffle.findAll();
      return res.json({ message: 'Raffle deleted', remainingRaffles: remainingRaffles });
    } catch (error) {
      console.error('[SERVER] => Error deleting raffle:', error);
      return res.status(500).json({ message: 'Error deleting raffle' });
    }
  }

  async createRaffle(req, res) {
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
  }

  async listRaffleNumbers(req, res) {
    const { email } = req.params;
  
    try {
      const raffleNumbers = await RaffleNumber.findAll({
        attributes: ['number', 'status', 'raffleId'],
        where: { email: email }
      });
  
      // Extract raffleIds from the fetched raffleNumbers
      const raffleIds = raffleNumbers.map(number => number.raffleId);
  
      // Fetch the corresponding raffles using raffleIds
      const raffles = await Raffle.findAll({
        attributes: ['id', 'title', 'description'], // You can include other attributes you need
        where: { id: raffleIds }
      });
  
      // Combine raffleNumbers with raffles based on raffleId
      const combinedData = raffleNumbers.map(number => {
        const raffle = raffles.find(r => r.id === number.raffleId);
        return {
          number: number.number,
          status: number.status,
          raffle: raffle
        };
      });
  
      return res.json(combinedData);
    } catch (error) {
      console.error('[SERVER] => Error fetching raffle numbers:', error);
      return res.status(500).json({ message: 'Error fetching raffle numbers' });
    }
  }
  
}

export default RaffleController;