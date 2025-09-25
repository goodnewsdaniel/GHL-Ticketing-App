import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

  // --- START: CONFIGURATION ---

  /* 1. PASTE YOUR SUPABASE URL and ANON KEY (from Step 1) */
  const SUPABASE_URL = 'https://gtxgnbrjfodzjgmfusro.supabase.co'; 

  const SUPABASE_ANON_KEY = ' eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eGduYnJqZm9kempnbWZ1c3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MjQ4NTIsImV4cCI6MjA3NDQwMDg1Mn0.wnXjxbh3aBUmjb0AGWonNkYBkwdDjPEm4tNcJhiIwrQ';

  /* 2. MAP YOUR SEAT IDs TO YOUR GOHIGHLEVEL PRODUCT IDs */

  const seatProductMapping = {
    'table-1': '68d2bf1de7fabb022d742289', // Replace with actual Product ID
    'table-2': '68d2bf2b9ea7b17aca2040f9',    // Replace with actual Product ID
    'table-3': '68d2bf3924eb7a481495e225',    // Replace with actual Product ID
    'table-4': '68d2bf4795fa2d64a333f3da',    // Replace with actual Product ID
    'table-5': '68d2bf51e7fabb5d5e7422ba',    // Replace with actual Product ID
  };



  // 3. RESERVATION TIME (in minutes)
  const RESERVATION_MINUTES = 15;
  // --- END: CONFIGURATION ---

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let localReservation = { seatId: null, timerId: null };

  // Function to handle initial load and real-time updates
  function listenToSeatChanges() {
    supabase
      .channel('seats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, (payload) => {
        const { name, status } = payload.new;
        const seatElement = document.getElementById(name);
        if (seatElement) {
          seatElement.className = 'seat'; // Reset
          seatElement.classList.add(status);
          if (localReservation.seatId === name) {
            seatElement.classList.add('selected');
          }
        }
      })
      .subscribe();
  }

  // Initial fetch of all seats
  async function fetchInitialSeats() {
    const { data, error } = await supabase.from('seats').select('*');
    if (error) {
      console.error('Error fetching seats:', error);
      return;
    }
    data.forEach(seat => {
      const seatElement = document.getElementById(seat.name);
      if (seatElement) {
        seatElement.className = 'seat'; // Reset
        seatElement.classList.add(seat.status);
      }
    });
  }

  // Add click listeners to all seat elements
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
      alert('You already have a seat selected.');
      return;
    }
    if (currentStatus === 'available') {
      reserveSeat(seatId);
    } else if (localReservation.seatId === seatId) {
      releaseSeat(seatId, true);
    }
  }

  // The rest of the timer and GHL interaction code remains the same as before...
  // (reserveSeat, releaseSeat, startTimer, selectGHLProduct functions)
  // The only change needed is how reserveSeat and releaseSeat update the database.

  async function reserveSeat(seatId) {
      /* In Supabase, we can't do a "transaction" from the front-end. We'll use a serverless Edge Function for this to do it atomically and prevent race conditions.
      This is a more advanced topic. For simplicity here, we'll do a direct update. A user might be able to reserve a seat that was taken milliseconds before. A proper solution would use an RPC call to a Postgres function. */

      const { data, error } = await supabase
          .from('seats')
          .update({ status: 'reserved' })
          .eq('name', seatId)
          .eq('status', 'available') // Only update if it's currently available
          .select();

      if (error || data.length === 0) {
          alert('Sorry, this seat was just taken! Please select another.');
      } else {
          localReservation.seatId = seatId;
          document.getElementById(seatId)?.classList.add('selected');
          selectGHLProduct(seatId, true);
          startTimer();
      }
  }

  async function releaseSeat(seatId, isManual) {
      if (!seatId) return;

      clearInterval(localReservation.timerId);
      document.getElementById('reservation-timer').style.display = 'none';
      document.getElementById(seatId)?.classList.remove('selected');
      selectGHLProduct(seatId, false);

      const wasOurReservation = localReservation.seatId === seatId;
      localReservation = { seatId: null, timerId: null };

      if (wasOurReservation) {
          await supabase
              .from('seats')
              .update({ status: 'available' })
              .eq('name', seatId)
              .eq('status', 'reserved'); // Only release if it was reserved
      }
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

  function selectGHLProduct(seatId, shouldSelect) {
    const productId = seatProductMapping[seatId];
    if (!productId) return;
    const productInput = document.querySelector(`input[type="checkbox"][value^="${productId}"]`);
    if (productInput) {
        productInput.checked = shouldSelect;
        productInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Initialize the map
  fetchInitialSeats();
  listenToSeatChanges();