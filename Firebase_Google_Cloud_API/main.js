// --- START: CONFIGURATION ---
  // You MUST update these values

  // 1. PASTE YOUR FIREBASE CONFIG OBJECT (from Step 1)
  const firebaseConfig = {
  apiKey: "AIzaSyA8j37uz9sZZp3rHYK8gMVt8dcPOcEVOfI",
  authDomain: "realpromo-9d702.firebaseapp.com",
  databaseURL: "https://realpromo-9d702-default-rtdb.firebaseio.com",
  projectId: "realpromo-9d702",
  storageBucket: "realpromo-9d702.firebasestorage.app",
  messagingSenderId: "667985871365",
  appId: "1:667985871365:web:bc3cda255cf28534e3526c",
  measurementId: "G-98L1WPYCC0"
};


  // 2. DEFINE SEAT POSITIONS & SIZES (in pixels)
  // This is the most manual part. You need to find the top/left coordinates
  // for each seat on your image. A browser's inspect tool can help.
  const seatPositions = {
    'table-1': { top: 50, left: 100, width: 40, height: 40 },
    'table-2': { top: 50, left: 150, width: 40, height: 40 },
    'table-3': { top: 50, left: 200, width: 40, height: 40 },
    'table-4': { top: 120, left: 125, width: 40, height: 40 },
    'table-5': { top: 120, left: 175, width: 40, height: 40 }
  };

  // 3. MAP YOUR SEAT IDs TO YOUR GOHIGHLEVEL PRODUCT IDs
  // To find a product ID, inspect the radio button for that product on your funnel.
  // The 'value' attribute of the input tag is the product ID.
  const seatProductMapping = {
    'table-1': '68d2bf1de7fabb022d742289', // Replace with actual Product ID
    'table-2': '68d2bf2b9ea7b17aca2040f9',    // Replace with actual Product ID
    'table-3': '68d2bf3924eb7a481495e225',    // Replace with actual Product ID
    'table-4': '68d2bf4795fa2d64a333f3da',    // Replace with actual Product ID
    'table-5': '68d2bf51e7fabb5d5e7422ba',    // Replace with actual Product ID
  };

  // 4. RESERVATION TIME (in minutes)
  const RESERVATION_MINUTES = 15;

  // --- END: CONFIGURATION ---


  // Import Firebase SDK
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
  import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const seatsRef = ref(database, 'seats');

  let localReservation = {
    seatId: null,
    timerId: null
  };
  
  // Wait for the page to fully load
  document.addEventListener('DOMContentLoaded', function() {
    const wrapper = document.getElementById('seat-map-wrapper');
    if (!wrapper) {
      console.error("Seat map wrapper not found!");
      return;
    }
    initializeMap(wrapper);
  });

  // Function to draw seats and listen for real-time updates
  function initializeMap(wrapper) {
    onValue(seatsRef, (snapshot) => {
      const seatsData = snapshot.val();
      wrapper.querySelectorAll('.seat-overlay').forEach(el => el.remove()); // Clear old seats

      for (const seatId in seatsData) {
        const seatDiv = document.createElement('div');
        seatDiv.id = seatId;
        seatDiv.className = 'seat-overlay';
        
        // Apply position from config
        const pos = seatPositions[seatId];
        if (pos) {
          Object.assign(seatDiv.style, {
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            width: `${pos.width}px`,
            height: `${pos.height}px`
          });
        }
        
        // Apply status class from Firebase
        const status = seatsData[seatId].status || 'unavailable';
        seatDiv.classList.add(status);

        // Add click listener
        seatDiv.addEventListener('click', () => handleSeatClick(seatId, status));
        
        wrapper.appendChild(seatDiv);
      }
    });
  }

  // Function to handle a click on a seat
  function handleSeatClick(seatId, currentStatus) {
    if (localReservation.seatId && localReservation.seatId !== seatId) {
        alert('You already have a seat selected. Please release it first or complete your purchase.');
        return;
    }

    if (currentStatus === 'available') {
        // Attempt to reserve the seat
        const seatRef = ref(database, `seats/${seatId}`);
        runTransaction(seatRef, (currentData) => {
            if (currentData.status === 'available') {
                return { 
                    status: 'reserved',
                    reservedAt: Date.now() // Using a timestamp
                };
            }
            return; // Abort transaction if seat is not available
        }).then(({ committed }) => {
            if (committed) {
                console.log('Seat reserved!');
                localReservation.seatId = seatId;
                startTimer();
                selectGHLProduct(seatId, true);
                document.getElementById(seatId)?.classList.add('selected');
            } else {
                alert('Sorry, this seat was just taken! Please select another.');
            }
        });
    } else if (localReservation.seatId === seatId) {
        // This is our own reservation, let's release it
        releaseSeat(seatId, true);
    }
  }

  // Function to start the countdown timer
  function startTimer() {
    const timerElement = document.getElementById('reservation-timer');
    const countdownElement = document.getElementById('countdown');
    if (!timerElement || !countdownElement) return;

    timerElement.style.display = 'block';
    let duration = RESERVATION_MINUTES * 60;

    localReservation.timerId = setInterval(() => {
      let minutes = Math.floor(duration / 60);
      let seconds = duration % 60;
      seconds = seconds < 10 ? '0' + seconds : seconds;
      countdownElement.textContent = `${minutes}:${seconds}`;

      if (--duration < 0) {
        releaseSeat(localReservation.seatId, false);
        alert('Your reservation has expired. Please select a seat again.');
      }
    }, 1000);
  }

  // Function to release a reserved seat
  function releaseSeat(seatId, isManual) {
    if (!seatId) return;

    // Clear timer and local state
    clearInterval(localReservation.timerId);
    localReservation = { seatId: null, timerId: null };
    document.getElementById('reservation-timer').style.display = 'none';

    // Deselect product and remove visual cue
    selectGHLProduct(seatId, false);
    document.getElementById(seatId)?.classList.remove('selected');

    // Update Firebase if it was our reservation
    const seatRef = ref(database, `seats/${seatId}`);
    runTransaction(seatRef, (currentData) => {
        // Only release if it was reserved (don't override a "sold" status)
        if (currentData && currentData.status === 'reserved') {
            return { status: 'available' };
        }
        return; // Abort
    });

    if (isManual) {
        console.log('Reservation released.');
    }
  }

  // Function to interact with GHL's product Checkbox/Radio
  function selectGHLProduct(seatId, shouldSelect) {
    const productId = seatProductMapping[seatId];
    if (!productId) return;
    
    // The selector might need adjustment based on GHL's current HTML structure
    const productInput = document.querySelector(`input[type="checkbox"][value^="${productId}"]`);
    
    if (productInput) {
        productInput.checked = shouldSelect;
        // Trigger change event for GHL's framework to detect it
        productInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        console.warn(`GHL Product input not found for ID: ${productId}`);
    }
  }
