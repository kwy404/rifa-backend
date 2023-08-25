import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/db.js';

class RaffleNumber extends Model {}

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

export default RaffleNumber;
