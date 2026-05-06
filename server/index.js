import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// HEALTH CHECK - Test this first!
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'MOVE Backend is running!' });
});

// SIMPLE SEARCH API - Hardcoded for testing
app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  console.log('Search received:', query);
  
  // Hardcoded test data that WILL return results
  const testData = [
    { id: 1, name: 'Tokyo Haneda Airport', category: 'flight', price: 850 },
    { id: 2, name: 'Park Hyatt Tokyo', category: 'hotel', price: 450 },
    { id: 3, name: 'Tokyo Skytree', category: 'activity', price: 25 },
    { id: 4, name: 'Sushi Tokyo', category: 'food', price: 45 }
  ];
  
  // Filter based on query
  if (query && query.length > 0) {
    const results = testData.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase())
    );
    res.json(results);
  } else {
    res.json(testData);
  }
});

// REAL SEARCH DATA (your original)
const SEARCH_DATA = {
  flights: [
    { id: 'fl1', name: 'Tokyo Haneda (HND)', airline: 'ANA', price: 850, rating: 4.8, reviews: 12450 },
    { id: 'fl2', name: 'Narita (NRT)', airline: 'Japan Airlines', price: 820, rating: 4.7, reviews: 9820 }
  ],
  hotels: [
    { id: 'ht1', name: 'Park Hyatt Tokyo', pricePerNight: 450, rating: 4.9, reviews: 3200 }
  ],
  activities: [
    { id: 'ac1', name: 'Tokyo Skytree', price: 25, rating: 4.6, reviews: 45200 }
  ],
  food: [
    { id: 'fd1', name: 'Ichiran Ramen', price: 12, rating: 4.6, reviews: 34200 }
  ]
};

// FULL SEARCH ENDPOINT (optional)
app.get('/api/search/full', (req, res) => {
  const { q, type } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const searchTerm = q.toLowerCase();
  let results = [];
  
  Object.keys(SEARCH_DATA).forEach(cat => {
    const matches = SEARCH_DATA[cat].filter(item =>
      item.name.toLowerCase().includes(searchTerm)
    );
    results.push(...matches.map(m => ({ ...m, category: cat })));
  });
  
  res.json(results);
});

// Socket.IO (keep your existing Socket code)
const trips = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-trip', (tripId) => {
    socket.join(`trip-${tripId}`);
    console.log(`Joined trip ${tripId}`);
  });
  
  socket.on('add-item', (data) => {
    const { tripId, item } = data;
    io.to(`trip-${tripId}`).emit('item-added', item);
  });
  
  socket.on('vote-item', (data) => {
    const { tripId, itemId, voteType } = data;
    io.to(`trip-${tripId}`).emit('vote-updated', { itemId, voteType });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
