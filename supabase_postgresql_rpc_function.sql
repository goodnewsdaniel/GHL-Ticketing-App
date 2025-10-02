CREATE OR REPLACE FUNCTION try_reserve_seat(
    seat_id TEXT,
    reservation_minutes INTEGER
)
RETURNS json AS
$$
DECLARE
    seat_record RECORD;
    expiry_time TIMESTAMP;
BEGIN
    -- Calculate expiry time
    expiry_time := NOW() + (reservation_minutes || ' minutes')::INTERVAL;

    -- Try to update the seat status if it's available
    -- Use FOR UPDATE SKIP LOCKED to handle concurrent requests
    SELECT * INTO seat_record
    FROM seats
    WHERE name = seat_id AND status = 'available'
    FOR UPDATE SKIP LOCKED;

    -- If we found an available seat
    IF FOUND THEN
        -- Update the seat status
        UPDATE seats
        SET 
            status = 'reserved',
            reserved_at = NOW(),
            reservation_expires = expiry_time
        WHERE name = seat_id;

        -- Return success response
        RETURN json_build_object(
            'success', true,
            'message', 'Seat reserved successfully',
            'expires_at', expiry_time
        );
    ELSE
        -- Return failure response if seat wasn't available
        RETURN json_build_object(
            'success', false,
            'message', 'Seat is not available'
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Handle any unexpected errors
    RETURN json_build_object(
        'success', false,
        'message', 'An error occurred: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION try_reserve_seat TO authenticated, anon;

-- Make sure your seats table has the necessary columns
ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reservation_expires TIMESTAMP;

-- Create an index to improve query performance
CREATE INDEX IF NOT EXISTS idx_seats_name_status 
ON seats(name, status);

-- Optional: Create a function to automatically clean expired reservations
CREATE OR REPLACE FUNCTION clean_expired_reservations()
RETURNS void AS
$$
BEGIN
    UPDATE seats
    SET 
        status = 'available',
        reserved_at = NULL,
        reservation_expires = NULL
    WHERE 
        status = 'reserved' 
        AND reservation_expires < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a cron job to run clean_expired_reservations
-- Note: This requires pg_cron extension to be enabled
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('* * * * *', $$SELECT clean_expired_reservations()$$);