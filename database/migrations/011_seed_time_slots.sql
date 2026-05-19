BEGIN;

SET search_path TO fswm, public;

INSERT INTO time_slots (start_time, end_time, label)
VALUES
    ('07:00', '08:00', '7:00 AM - 8:00 AM'),
    ('08:00', '09:00', '8:00 AM - 9:00 AM'),
    ('09:00', '10:00', '9:00 AM - 10:00 AM'),
    ('10:00', '11:00', '10:00 AM - 11:00 AM'),
    ('11:00', '12:00', '11:00 AM - 12:00 PM'),
    ('12:00', '13:00', '12:00 PM - 1:00 PM'),
    ('13:00', '14:00', '1:00 PM - 2:00 PM'),
    ('14:00', '15:00', '2:00 PM - 3:00 PM'),
    ('15:00', '16:00', '3:00 PM - 4:00 PM'),
    ('16:00', '17:00', '4:00 PM - 5:00 PM'),
    ('17:00', '18:00', '5:00 PM - 6:00 PM'),
    ('18:00', '19:00', '6:00 PM - 7:00 PM')
ON CONFLICT (start_time, end_time) DO UPDATE
SET label = EXCLUDED.label;

COMMIT;
