import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const App = () => {
  // State
  const [trip, setTrip] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  
  const itineraryRef = useRef(null);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://move-trip-planner-production.up.railway.app';

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(backendUrl, {
      transports: ['websocket'],
      reconnection: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend');
    });

    newSocket.on('item-added', (item) => {
      setTrip(prev => ({
        ...prev,
        items: [...prev.items, item]
      }));
    });

    newSocket.on('vote-updated', ({ itemId, votes }) => {
      setTrip(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId ? { ...item, votes } : item
        )
      }));
    });

    newSocket.on('item-deleted', (itemId) => {
      setTrip(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      }));
    });

    newSocket.on('user-joined', () => {
      setOnlineUsers(prev => prev + 1);
    });

    newSocket.on('user-left', () => {
      setOnlineUsers(prev => Math.max(0, prev - 1));
    });

    newSocket.on('user-typing', ({ userName }) => {
      setTypingUsers(prev => [...prev, userName]);
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(name => name !== userName));
      }, 2000);
    });

    return () => newSocket.close();
  }, [backendUrl]);

  // Search API with debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        fetch(`${backendUrl}/api/search?q=${searchQuery}&type=${selectedType}`)
          .then(res => res.json())
          .then(data => setSearchResults(data))
          .catch(console.error);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedType, backendUrl]);

  // Create new trip
  const createTrip = (destination, startDate, endDate, pax, budget) => {
    const newTripId = Date.now().toString();
    const newTrip = {
      id: newTripId,
      destination,
      startDate,
      endDate,
      pax,
      budget,
      items: [],
      createdAt: new Date().toISOString()
    };
    
    setTrip(newTrip);
    setTripId(newTripId);
    
    if (socket) {
      socket.emit('join-trip', newTripId);
    }
  };

  // Add item from search
  const addItemFromSearch = (result) => {
    if (!socket || !tripId) return;
    
    const priceTotal = result.price || result.pricePerNight || 0;
    const newItem = {
      title: result.name,
      type: result.category,
      totalPrice: priceTotal * trip.pax,
      dayIndex: selectedDay,
      votes: { yes: 1, no: 0 }
    };
    
    socket.emit('add-item', { tripId, item: newItem });
    setShowAddModal(false);
    setSearchQuery('');
  };

  // Add custom item
  const addCustomItem = () => {
    if (!socket || !tripId || !customItemName.trim()) return;
    
    const totalPrice = parseFloat(customItemPrice) * trip.pax;
    const newItem = {
      title: customItemName,
      type: 'custom',
      totalPrice: isNaN(totalPrice) ? 0 : totalPrice,
      dayIndex: selectedDay,
      votes: { yes: 1, no: 0 }
    };
    
    socket.emit('add-item', { tripId, item: newItem });
    setShowAddModal(false);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  // Vote on item
  const vote = (itemId, voteType) => {
    if (socket && tripId) {
      socket.emit('vote-item', { tripId, itemId, voteType });
    }
  };

  // Delete item
  const deleteItem = (itemId) => {
    if (socket && tripId && window.confirm('Remove this item?')) {
      socket.emit('delete-item', { tripId, itemId });
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (socket && tripId) {
      socket.emit('typing', { tripId, userName: 'Someone' });
    }
  };

  // Calculate budget
  const calculateBudget = () => {
    if (!trip) return { totalSpent: 0, perPerson: 0, remaining: 0, percent: 0 };
    const totalSpent = trip.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const perPerson = totalSpent / trip.pax;
    const remaining = trip.budget - totalSpent;
    const percent = Math.min(100, (totalSpent / trip.budget) * 100);
    return { totalSpent, perPerson, remaining, percent };
  };

  // Get days array
  const getDays = () => {
    if (!trip) return [];
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    }
    return days;
  };

  const budget = trip ? calculateBudget() : null;
  const days = trip ? getDays() : [];

  // Render trip creation form
  if (!trip) {
    return (
      <div className="app">
        <div className="create-trip-container">
          <div className="create-trip-card">
            <div className="logo">🚀 MOVE</div>
            <h1>Plan trips with friends</h1>
            <p>Collaborate, vote, and stay on budget</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createTrip(
                formData.get('destination'),
                formData.get('startDate'),
                formData.get('endDate'),
                parseInt(formData.get('pax')),
                parseInt(formData.get('budget'))
              );
            }}>
              <input name="destination" placeholder="Destination (e.g., Tokyo, Japan)" required />
              <div className="date-row">
                <input name="startDate" type="date" required />
                <input name="endDate" type="date" required />
              </div>
              <input name="pax" type="number" placeholder="Number of travelers" min="1" defaultValue="4" required />
              <input name="budget" type="number" placeholder="Total budget (USD)" min="100" defaultValue="5000" required />
              <button type="submit" className="btn-primary">✨ Create Trip</button>
            </form>
            
            <button className="btn-secondary" onClick={() => {
              createTrip('Tokyo, Japan', '2025-04-10', '2025-04-14', 4, 5000);
            }}>🎲 Try Demo Trip</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-small">🚀 MOVE</div>
          <div className="trip-info">
            <h2>{trip.destination}</h2>
            <span className="trip-dates">
              {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="online-status">
            <span className="online-dot"></span>
            {onlineUsers} online
          </div>
          <button onClick={() => setShowItineraryModal(true)} className="icon-btn">📄 Export</button>
        </div>
      </header>
      
      {/* Budget Widget */}
      <div className="budget-widget">
        <div className="budget-stats">
          <div>
            <div className="budget-label">Total spent</div>
            <div className="budget-value">${budget.totalSpent.toFixed(2)}</div>
          </div>
          <div>
            <div className="budget-label">Per person</div>
            <div className="budget-value">${budget.perPerson.toFixed(2)}</div>
          </div>
          <div>
            <div className="budget-label">Remaining</div>
            <div className={`budget-value ${budget.remaining < 0 ? 'negative' : ''}`}>
              ${budget.remaining.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${budget.percent}%` }}></div>
        </div>
        {budget.remaining < 0 && (
          <div className="budget-warning">⚠️ Over budget by ${Math.abs(budget.remaining).toFixed(2)}</div>
        )}
      </div>
      
      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}
      
      {/* Timeline */}
      <div className="timeline">
        {days.map((day, idx) => {
          const dayItems = trip.items.filter(item => item.dayIndex === idx);
          const dayTotal = dayItems.reduce((sum, item) => sum + item.totalPrice, 0);
          
          return (
            <div key={idx} className="day-column">
              <div className="day-header">
                <div>
                  <div className="day-name">Day {idx + 1}</div>
                  <div className="day-date">{day}</div>
                </div>
                <button className="add-btn" onClick={() => {
                  setSelectedDay(idx);
                  setShowAddModal(true);
                }}>+</button>
              </div>
              
              <div className="day-items">
                {dayItems.map(item => {
                  const neededYes = Math.ceil(trip.pax * 0.75);
                  const isApproved = item.votes.yes >= neededYes;
                  const isRejected = item.votes.no >= Math.ceil(trip.pax * 0.5);
                  
                  return (
                    <div key={item.id} className={`item-card ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}`}>
                      <div className="item-header">
                        <span className="item-type">{item.type.toUpperCase()}</span>
                        <button className="delete-btn" onClick={() => deleteItem(item.id)}>🗑️</button>
                      </div>
                      <div className="item-title">{item.title}</div>
                      <div className="item-price">
                        <span>💰 ${item.totalPrice.toFixed(2)} total</span>
                        <span>👤 ${(item.totalPrice / trip.pax).toFixed(2)}/pax</span>
                      </div>
                      <div className="item-votes">
                        <div className="vote-count">
                          ✅ {item.votes.yes} · ❌ {item.votes.no}
                        </div>
                        <div className="vote-buttons">
                          <button onClick={() => vote(item.id, 'yes')} className="vote-yes">👍 Approve</button>
                          <button onClick={() => vote(item.id, 'no')} className="vote-no">👎 Veto</button>
                        </div>
                      </div>
                      {isApproved && <div className="status-badge approved">✓ Approved</div>}
                      {isRejected && <div className="status-badge rejected">✗ Rejected</div>}
                    </div>
                  );
                })}
              </div>
              
              <div className="day-footer">
                <div className="day-total">Day total: ${dayTotal.toFixed(2)}</div>
                <button className="add-item-bottom" onClick={() => {
                  setSelectedDay(idx);
                  setShowAddModal(true);
                }}>+ Add item</button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add to Day {selectedDay + 1}</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            
            <div className="category-filters">
              {['all', 'flight', 'hotel', 'activity', 'food'].map(type => (
                <button
                  key={type}
                  className={`category-chip ${selectedType === type ? 'active' : ''}`}
                  onClick={() => setSelectedType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            
            <input
              type="text"
              className="search-input"
              placeholder="Search flights, hotels, activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyUp={handleTyping}
            />
            
            <div className="search-results">
              {searchResults.map(result => (
                <div key={result.id} className="search-result" onClick={() => addItemFromSearch(result)}>
                  <div>
                    <div className="result-name">{result.name}</div>
                    <div className="result-meta">
                      ⭐ {result.rating} ({result.reviews?.toLocaleString()} reviews)
                      {result.airline && ` · ${result.airline}`}
                    </div>
                  </div>
                  <div className="result-price">
                    ${result.price || result.pricePerNight}
                    {result.pricePerNight && '/night'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="divider">or add custom</div>
            
            <input
              className="custom-input"
              placeholder="Custom item name (e.g., Private Tour)"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
            />
            <input
              className="custom-input"
              type="number"
              placeholder="Price per person (USD)"
              value={customItemPrice}
              onChange={(e) => setCustomItemPrice(e.target.value)}
            />
            <button onClick={addCustomItem} className="btn-primary">➕ Add Custom Item</button>
          </div>
        </div>
      )}
      
      {/* Itinerary Modal */}
      {showItineraryModal && (
        <div className="modal-overlay" onClick={() => setShowItineraryModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 Trip Itinerary</h3>
              <button onClick={() => setShowItineraryModal(false)}>✕</button>
            </div>
            
            <div ref={itineraryRef} className="itinerary-preview">
              <div className="itinerary-header">
                <div className="itinerary-logo">🚀 MOVE Trip Planner</div>
                <h1>{trip.destination}</h1>
                <p>{new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</p>
                <p>{trip.pax} travelers · Budget: ${trip.budget}</p>
              </div>
              
              {days.map((day, idx) => {
                const dayItems = trip.items.filter(item => item.dayIndex === idx);
                return (
                  <div key={idx} className="itinerary-day">
                    <h3>Day {idx + 1}: {day}</h3>
                    {dayItems.map(item => (
                      <div key={item.id} className="itinerary-item">
                        <div className="itinerary-item-type">{item.type}</div>
                        <div className="itinerary-item-name">{item.title}</div>
                        <div className="itinerary-item-price">${item.totalPrice.toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="itinerary-day-total">
                      Day total: ${dayItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
                    </div>
                  </div>
                );
              })}
              
              <div className="itinerary-total">
                <strong>Grand Total: ${budget.totalSpent.toFixed(2)}</strong>
                <div>Per person: ${budget.perPerson.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => window.print()} className="btn-primary">🖨️ Print / Save as PDF</button>
              <button onClick={() => setShowItineraryModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
