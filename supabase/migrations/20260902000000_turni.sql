CREATE TABLE IF NOT EXISTS turni (
  user_id  TEXT NOT NULL,
  data     DATE NOT NULL,
  turno    TEXT NOT NULL CHECK (turno IN ('pranzo', 'sera')),
  PRIMARY KEY (user_id, data, turno)
);

ALTER TABLE turni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON turni FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON turni TO anon, authenticated, service_role, authenticator;
