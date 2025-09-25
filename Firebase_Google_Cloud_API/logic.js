
  /* --- START: CONFIGURATION ---*/
  
  /*1. PASTE YOUR FIREBASE CONFIG OBJECT (from Step 1)*/

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

  /* 2. MAP YOUR SEAT IDs TO YOUR GOHIGHLEVEL PRODUCT IDs
    To find a product ID, inspect the checkbox/radio button for that product on your funnel page.
    The 'value' attribute of the input tag is the product ID. 
  */

  const seatProductMapping = {
    'table-1': '68d2bf1de7fabb022d742289', // Replace with actual Product ID
    'table-2': '68d2bf2b9ea7b17aca2040f9',    // Replace with actual Product ID
    'table-3': '68d2bf3924eb7a481495e225',    // Replace with actual Product ID
    'table-4': '68d2bf4795fa2d64a333f3da',    // Replace with actual Product ID
    'table-5': '68d2bf51e7fabb5d5e7422ba',    // Replace with actual Product ID
  };

  /* 3. RESERVATION TIME (in minutes)*/
  const RESERVATION_MINUTES = 15;

  /* --- END: CONFIGURATION ---*/


  /* Import Firebase SDK */
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
  import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const seatsRef = ref(database, 'seats');

  let localReservation = { seatId: null, timerId: null };

  /* Listen for real-time updates from Firebase and apply them to the HTML */ 
  onValue(seatsRef, (snapshot) => {
    const seatsData = snapshot.val();
    for (const seatId in seatsData) {
      const seatElement = document.getElementById(seatId);
      if (seatElement) {
        const status = seatsData[seatId].status || 'unavailable';
        seatElement.className = 'seat'; // Reset classes
        seatElement.classList.add(status);
        if (localReservation.seatId === seatId) {
            seatElement.classList.add('selected');
        }
      }
    }
  });

  /*  Add click listeners to all elements with the 'seat' class */
  document.querySelectorAll('.seat').forEach(seat => {
    seat.addEventListener('click', () => {
      const seatId = seat.id;
      const currentStatus = seat.classList.contains('available') ? 'available' :
                            seat.classList.contains('reserved') ? 'reserved' : 'unavailable';
      handleSeatClick(seatId, currentStatus);
    });
  });

  function handleSeatClick(seatId, currentStatus) {
    if (localReservation.seatId && localReservation.seatId !== seatId) {
        alert('You already have a seat selected. Please release it first or complete your purchase.');
        return;
    }
    if (currentStatus === 'available') {
        reserveSeat(seatId);
    } else if (localReservation.seatId === seatId) {
        releaseSeat(seatId, true);
    }
  }

  function reserveSeat(seatId) {
    const seatRef = ref(database, `seats/${seatId}`);
    runTransaction(seatRef, (currentData) => {
        if (currentData && currentData.status === 'available') {
            return { status: 'reserved', reservedAt: Date.now() };
        }
        return; // Abort transaction
    }).then(({ committed }) => {
        if (committed) {
            localReservation.seatId = seatId;
            document.getElementById(seatId)?.classList.add('selected');
            selectGHLProduct(seatId, true);
            startTimer();
        } else {
            alert('Sorry, this seat was just taken! Please select another.');
        }
    });
  }

  function startTimer() {
    const timerElement = document.getElementById('reservation-timer');
    const countdownElement = document.getElementById('countdown');
    if (!timerElement || !countdownElement) return;

    timerElement.style.display = 'block';
    let duration = RESERVATION_MINUTES * 60;

    localReservation.timerId = setInterval(() => {
      if (--duration < 0) {
        releaseSeat(localReservation.seatId, false);
        alert('Your reservation has expired. Please select a seat again.');
      } else {
        let minutes = Math.floor(duration / 60);
        let seconds = duration % 60;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        countdownElement.textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }

  function releaseSeat(seatId, isManual) {
    if (!seatId) return;

    clearInterval(localReservation.timerId);
    document.getElementById('reservation-timer').style.display = 'none';
    document.getElementById(seatId)?.classList.remove('selected');
    selectGHLProduct(seatId, false);

    const wasOurReservation = localReservation.seatId === seatId;
    localReservation = { seatId: null, timerId: null };

    if (wasOurReservation) {
        const seatRef = ref(database, `seats/${seatId}`);
        runTransaction(seatRef, (currentData) => {
            if (currentData && currentData.status === 'reserved') {
                return { status: 'available' };
            }
            return;
        });
    }
  }

  function selectGHLProduct(seatId, shouldSelect) {
    const productId = seatProductMapping[seatId];
    if (!productId) return;
    const productInput = document.querySelector(`input[type="radio"][value^="${productId}"]`);
    if (productInput) {
        productInput.checked = shouldSelect;
        productInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }