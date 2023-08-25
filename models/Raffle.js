import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/db.js';

class Raffle extends Model {}

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
  minTickets: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  maxTickets: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  totalTickets: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, { sequelize, modelName: 'raffle' });

export default Raffle;