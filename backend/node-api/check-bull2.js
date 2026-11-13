const Bull = require('bull');
console.log('Bull:', Bull);
console.log('Bull.default:', Bull.default);
console.log('typeof Bull:', typeof Bull);
if (typeof Bull === 'function') {
  console.log('Bull is a function (constructor)');
}