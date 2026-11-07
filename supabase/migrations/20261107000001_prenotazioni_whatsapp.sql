-- Prenotazioni: quando è partita la conferma / il promemoria su WhatsApp.
-- Servono a mostrare "✓ conferma inviata" e a non mandare due volte lo stesso messaggio.
-- La tabella ha già RLS + policy staff_all e sta nella publication realtime: nessuna modifica lì.
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS wa_conferma_at timestamptz;
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS wa_promemoria_at timestamptz;
