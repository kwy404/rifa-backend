import { execSync } from 'child_process';
import chalk from 'chalk';

try {
  // Tenta executar o comando "nodemon"
  execSync('nodemon index.js', { stdio: 'inherit' });
} catch (error) {
  // Se ocorrer um erro, provavelmente o nodemon não está instalado
  console.error(chalk.magenta('[ SERVER ] =>'), 'Nodemon is not installed.');
  console.error(chalk.magenta('[ SERVER ] =>'), 'Installing nodemon...');

  try {
    // Tenta instalar o nodemon localmente
    execSync('npm install --save-dev nodemon', { stdio: 'inherit' });
    console.log(chalk.magenta('[ SERVER ] =>'), 'Nodemon installed successfully.');
    console.log(chalk.magenta('[ SERVER ] =>'), 'Starting server with nodemon...');

    // Inicia o servidor com o nodemon recém-instalado
    execSync('nodemon index.js', { stdio: 'inherit' });
  } catch (installError) {
    console.error(chalk.magenta('[ SERVER ] =>'), 'Failed to install nodemon.');
    console.error(chalk.magenta('[ SERVER ] =>'), 'Please install nodemon manually using: npm install --save-dev nodemon');
  }
}
