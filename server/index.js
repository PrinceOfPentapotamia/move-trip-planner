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

// Search API
const SEARCH_DATA = {
  flights: [
    { id: 'fl1', name: 'Tokyo Haneda (HND)', airline: 'ANA', price: 850, rating: 4.8, reviews: 12450 },
    { id: 'fl2', name: 'Narita (NRT)', airline: 'Japan Airlines', price: 820, rating: 4.7, reviews: 9820 }
  ],
  hotels: [
    { id: 'ht1', name: 'Park Hyatt Tokyo', pricePerNight: 450, rating: 4.9, reviews: 3200 },
    { id: 'ht2', name: 'Cerulean Tower Tokyu Hotel', pricePerNight: 280, rating: 4.7, reviews: 2100 }
  ],
  activities: [
    { id: 'ac1', name: 'Tokyo Skytree', price: 25, rating: 4.6, reviews: 45200 },
    { id: 'ac2', name: 'teamLab Planets', price: 30, rating: 4.8, reviews: 18700 }
  ],
  food: [
    { id: 'fd1', name: 'Ichiran Ramen', price: 12, rating: 4.6, reviews: 34200 },
    { id: 'fd2', name: 'Sushi Dai', price: 45, rating: 4.9, reviews: 5600 }
  ]
};

app.get('/api/search', (req, res) => {
  const { q, type } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  const searchTerm = q.toLowerCase();
  let results = [];
  const categories = type === 'all' ? Object.keys(SEARCH_DATA) : [type];
  
  categories.forEach(cat => {
    if (SEARCH_DATA[cat]) {
      const matches = SEARCH_DATA[cat].filter(item =>
        item.name.toLowerCase().includes(searchTerm)
      );
      results.push(...matches.map(m => ({ ...m, category: cat })));
    }
  });
  
  res.json(results.slice(0, 10));
});

// Store active trips
const trips = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-trip', (tripId) => {
    socket.join(`trip-${tripId}`);
    if (trips.has(tripId)) {
      socket.emit('trip-state', trips.get(tripId));
    }
  });
  
  socket.on('add-item', (data) => {
    const { tripId, item } = data;
    if (!trips.has(tripId)) {
      trips.set(tripId, { items: [] });
    }
    const trip = trips.get(tripId);
    const newItem = { ...item, id: Date.now(), votes: { yes: 1, no: 0 } };
    trip.items.push(newItem);
    io.to(`trip-${tripId}`).emit('item-added', newItem);
  });
  
  socket.on('vote-item', (data) => {
    const { tripId, itemId, voteType } = data;
    const trip = trips.get(tripId);
    if (trip) {
      const item = trip.items.find(i => i.id === itemId);
      if (item) {
        if (voteType === 'yes') item.votes.yes++;
        else item.votes.no++;
        io.to(`trip-${tripId}`).emit('vote-updated', { itemId, votes: item.votes });
      }
    }
  });
  
  socket.on('delete-item', (data) => {
    const { tripId, itemId } = data;
    const trip = trips.get(tripId);
    if (trip) {
      trip.items = trip.items.filter(i => i.id !== itemId);
      io.to(`trip-${tripId}`).emit('item-deleted', itemId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
