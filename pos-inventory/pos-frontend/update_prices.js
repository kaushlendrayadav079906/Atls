const fs = require('fs');

// Read the file
const filePath = './src/data/mockData.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Price conversion map (USD to INR, rounded nicely)
const priceMap = {
  '4.49': '375',
  '5.99': '499',
  '7.29': '599',
  '7.79': '649',
  '8.29': '699',
  '8.99': '749',
  '9.79': '825',
  '9.99': '849',
  '10.29': '875',
  '10.79': '899',
  '10.99': '925',
  '11.49': '975',
  '11.99': '999',
  '12.99': '1099',
  '14.79': '1249',
  '14.99': '1299',
  '15.99': '1349',
  '17.99': '1499',
  '18.49': '1549'
};

// Replace all prices
Object.entries(priceMap).forEach(([usd, inr]) => {
  const regex = new RegExp(`price: ${usd},`, 'g');
  content = content.replace(regex, `price: ${inr},`);
});

// Write back to file
fs.writeFileSync(filePath, content);
console.log('Prices updated successfully!');
