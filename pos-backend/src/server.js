require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_mvp_unified')
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start server', err);
  });
